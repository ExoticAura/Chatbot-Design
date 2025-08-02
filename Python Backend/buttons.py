import os
import state
import hashlib
from pdf_handler import rebuild_vectorstore
from utils import format_key_points, read_aloud_start, read_aloud_stop
from state import is_new_conversation, current_filename


def _should_hide_sources(answer_text: str) -> bool:
    """
    Returns True if the bot's answer indicates no relevant PDF info was found.
    """
    text = answer_text.lower()
    keywords = [
        "i am sorry",
        "i'm sorry",
        "does not contain information",
        "cannot answer your question",
        "no relevant info",
        "doesn't mention"
    ]
    return any(kw in text for kw in keywords)

def rebuild_if_needed():
    """
    Checks if the set of enabled PDFs has changed and rebuilds the 
    vectorstore only if necessary. This prevents slow, repeated rebuilds.
    """
    enabled_files = [data["path"] for data in state.files_data.values() if data["enabled"]]
    
    if not enabled_files:
        # If no files are enabled, clear the vectorstore
        if state.active_files_hash is not None:
            print("No files enabled. Clearing knowledge base.")
            state.vectorstore = None
            state.qa_chain = None
            state.active_files_hash = None
        return

    # Create a unique hash of the current list of enabled files
    file_str = "".join(sorted([os.path.basename(f) for f in enabled_files]))
    current_hash = hashlib.md5(file_str.encode()).hexdigest()

    # If the hash is different from the last active one, a rebuild is required
    if current_hash != state.active_files_hash:
        print("Change in active files detected. Rebuilding knowledge base...")
        rebuild_vectorstore()
        state.active_files_hash = current_hash # Update the hash to the new state
    else:
        print("Knowledge base is already up-to-date.")


def handle_query_with_return(user_input):
    """
    Process user's query, return response (sources only if valid).
    Follow-up suggestions are stored separately in state.last_suggestions.
    """
    try:
        # --- Crucial Step: Check if the knowledge base needs updating ---
        rebuild_if_needed()

        state.stop_response = False  # Reset stop flag at start

        user_input_lower = user_input.strip().lower()
        state.last_suggestions = []  # Reset suggestions on new query

        # Handle small talk
        small_talk_responses = {
            "hi": "Hello! 👋 How can I help you today?",
            "hello": "Hi there! 👋",
            "hey": "Hey! 👋",
            "yo": "Yo! What's up?",
            "sup": "Not much! How can I assist you?",
            "how are you": "I'm great, thanks for asking! 😊 How about you?",
        }
        if user_input_lower in small_talk_responses:
            final = small_talk_responses[user_input_lower]
            state.chat_history.append((user_input, final))
            state.last_bot_response = final
            state.save_current_chat()
            return final

        # If no QA chain exists (no PDFs loaded or an error occurred)
        if not state.qa_chain:
            return "⚠️ Knowledge base is empty or not loaded. Please upload and enable a PDF."

        # Follow-up questions referencing previous question
        if "previous question" in user_input_lower or "from the previous" in user_input_lower:
            if len(state.chat_history) >= 1:
                if state.stop_response: return "🟥 Response was stopped."
                prev_q, prev_a = state.chat_history[-1]
                prompt = f"""
                You are continuing a conversation.

                Previous Question: "{prev_q}"
                Previous Answer: "{prev_a}"

                Now answer this follow-up question based on the context above:
                "{user_input}"
                """
                result = state.qa_chain.invoke({
                    "question": f"Use all available PDF context:\n{user_input}",
                    "chat_history": state.chat_history
                })

                if state.stop_response: return "🟥 Response was stopped."

                bot_text = format_key_points(result["answer"].strip())

                # Retry if empty or duplicate
                if _should_hide_sources(bot_text) or bot_text == state.last_bot_response:
                    if state.stop_response: return "🟥 Response was stopped."
                    retry_prompt = f"""
                    Recheck all context carefully and expand on this answer:
                    {user_input}
                    """
                    retry = state.suggestion_llm.invoke(retry_prompt)
                    if state.stop_response: return "🟥 Response was stopped."
                    if retry and retry.content:
                        bot_text = retry.content.strip()

                sources_text = _build_sources_text(result, bot_text)
                final = f"{bot_text}{sources_text}"

                state.chat_history.append((user_input, final))
                state.last_bot_response = final
                return final

            return "I don’t have enough history to reference the previous question."

        # Main Query: search vectorstore
        if state.stop_response: return "🟥 Response was stopped."
        result = state.qa_chain.invoke({
            "question": f"Use all available PDF context:\n{user_input}",
            "chat_history": state.chat_history
        })
        if state.stop_response: return "🟥 Response was stopped."

        bot_text = format_key_points(result["answer"].strip())

        # Retry if answer is missing or duplicate
        if _should_hide_sources(bot_text) or bot_text == state.last_bot_response:
            if state.stop_response: return "🟥 Response was stopped."
            retry_prompt = f"""
            Carefully search the entire PDF and answer clearly:
            {user_input}
            """
            retry = state.suggestion_llm.invoke(retry_prompt)
            if state.stop_response: return "🟥 Response was stopped."
            if retry and retry.content:
                bot_text = retry.content.strip()

        sources_text = _build_sources_text(result, bot_text)

        # Generate follow-up suggestions
        if not _should_hide_sources(bot_text):
            if state.stop_response: return "🟥 Response was stopped."
            followup_prompt = (
                f"Suggest 2 concise follow-up questions (10 words max each) "
                f"based on this answer:\n{bot_text}"
            )
            followup = state.suggestion_llm.invoke(followup_prompt)
            if state.stop_response: return "🟥 Response was stopped."
            if followup and followup.content:
                suggestions_raw = [
                    line.strip("-•* ")
                    for line in followup.content.splitlines()
                    if line.strip()
                ]
                state.last_suggestions = [s for s in suggestions_raw if s.endswith("?")][:2]

        final = f"{bot_text}{sources_text}"
        state.chat_history.append((user_input, final)) 
        state.last_bot_response = final # Save the last response
        state.save_current_chat()
        return final

    except Exception as e:
        state.last_suggestions = []
        return f"❌ Oops! An error occurred: {e}"


def _build_sources_text(result, bot_text):
    """Generate sources text if valid."""
    sources_dict = {}
    if "source_documents" in result:
        for doc in result["source_documents"]:
            src = os.path.basename(doc.metadata.get("source", ""))
            page = str(doc.metadata.get("page", ""))
            if src and page:
                sources_dict.setdefault(src, set()).add(page)

    if sources_dict and not _should_hide_sources(bot_text):
        sources_text = "\n\n📚 Sources:\n"
        for src, pages in sorted(sources_dict.items()):
            sources_text += f"• {src} (p. {', '.join(sorted(list(pages), key=int))})\n"
        return sources_text

    return ""


def add_pdf(file_path):
    """Adds a PDF to the file list. Does not trigger a rebuild."""
    filename = os.path.basename(file_path)
    state.files_data[filename] = {"path": file_path, "enabled": True}
    print(f"PDF '{filename}' added to the list.")
    # The rebuild will happen automatically before the next query if needed.


def toggle_pdf(filename, enabled):
    """Toggles a PDF's enabled state. Does not trigger a rebuild."""
    if filename in state.files_data:
        state.files_data[filename]["enabled"] = enabled
        print(f"PDF '{filename}' set to enabled={enabled}.")
    # The rebuild will happen automatically before the next query if needed.


def read_aloud_response():
    if state.chat_history:
        latest_bot_response = state.chat_history[-1][1]
        read_aloud_start(latest_bot_response)


def stop_read_aloud():
    read_aloud_stop()
    state.stop_response = True


def start_new_chat():
    global is_new_conversation, current_filename

    if state.chat_history:
        state.save_current_chat()
    state.chat_history.clear()
    state.last_bot_response = ""
    state.last_suggestions = []

    is_new_conversation = True      # Mark that we're starting fresh
    current_filename = ""           # Reset the filename

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
import state

def create_qa_chain(vectorstore):
    """Create a conversational retrieval chain with memory and return sources."""
    llm = ChatGoogleGenerativeAI(
        model=state.model_name,
        temperature=0.3,
        google_api_key=state.api_key
    )

    if state.memory is None:
        state.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
            output_key="answer"
        )

    qa_chain = ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 4}),
        memory=state.memory,
        return_source_documents=True,
        output_key="answer"  # ✅ This is the correct key for your version
    )
    return qa_chain


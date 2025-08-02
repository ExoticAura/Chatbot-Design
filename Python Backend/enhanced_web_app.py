import os
import json
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import state
from buttons import handle_query_with_return, toggle_pdf, start_new_chat, add_pdf
from pdf_handler import rebuild_vectorstore
from utils import read_aloud_start, read_aloud_stop

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

UPLOAD_FOLDER = "uploads"
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route("/")
def home():
    return jsonify({"message": "Gemini Chatbot API is running", "status": "active"})

# Main chat API
@app.route("/ask", methods=["POST"])
def ask():
    data = request.json
    user_input = data.get("message", "")
    response_text = handle_query_with_return(user_input)
    return jsonify({
        "response": response_text,
        "suggestions": state.last_suggestions
    })

# Chat history APIs
@app.route("/chat_history")
def chat_history():
    return jsonify({"history": state.chat_history})

@app.route("/new_chat", methods=["POST"])
def new_chat():
    start_new_chat()
    return jsonify({"success": True})

# Manage files APIs
@app.route("/upload", methods=["POST"])
def upload():
    if "pdf" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["pdf"]
    filename = file.filename
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    # Save the file
    file.save(filepath)

    # Add to state and rebuild vectorstore
    add_pdf(filepath)
    rebuild_vectorstore()

    return jsonify({"success": f"{filename} added and indexed"})

@app.route("/get_files", methods=["GET"])
def get_files():
    return jsonify(state.files_data)

@app.route("/toggle_file", methods=["POST"])
def toggle_file():
    data = request.json
    filename = data.get("filename")
    enabled = data.get("enabled", True)
    if filename in state.files_data:
        toggle_pdf(filename, enabled)
        rebuild_vectorstore()
        return jsonify({"success": f"{filename} updated"})
    return jsonify({"error": "File not found"}), 404

# Settings APIs
@app.route("/update_model", methods=["POST"])
def update_model():
    data = request.json
    new_model = data.get("model_name")
    new_api_key = data.get("api_key")

    allowed_models = ["gemini-1.5-flash", "gemini-2.0-flash"]
    if new_model and new_model not in allowed_models:
        return jsonify({"error": f"Invalid model. Allowed models: {', '.join(allowed_models)}"}), 400

    if new_api_key:
        os.environ["GEMINI_API_KEY"] = new_api_key
        state.api_key = new_api_key
    if new_model:
        state.model_name = new_model

    # Save settings permanently
    with open("settings.json", "w") as f:
        json.dump({
            "api_key": state.api_key,
            "model_name": state.model_name
        }, f, indent=2)

    from langchain_google_genai import ChatGoogleGenerativeAI
    state.suggestion_llm = ChatGoogleGenerativeAI(
        model=state.model_name, temperature=0.4, google_api_key=state.api_key
    )

    return jsonify({
        "success": True,
        "model_name": state.model_name,
        "api_key_set": bool(new_api_key or state.api_key)
    })

# Read Aloud APIs
@app.route("/read_aloud", methods=["POST"])
def read_aloud():
    text = request.json.get("text")
    if text:
        read_aloud_start(text)
        return jsonify({"success": True})
    return jsonify({"error": "No text"}), 400

@app.route("/stop_read_aloud", methods=["POST"])
def stop_read_aloud():
    read_aloud_stop()
    return jsonify({"success": True})

@app.route("/get_settings", methods=["GET"])
def get_settings():
    return jsonify({
        "model_name": state.model_name,
        "api_key_set": bool(state.api_key and state.api_key.strip())
    })

@app.route("/stop_response", methods=["POST"])
def stop_response():
    state.stop_response = True
    return jsonify({"success": True})

@app.route("/chat_list")
def chat_list():
    files = state.get_all_chat_files()
    return jsonify({"files": files})

@app.route("/load_chat_file", methods=["POST"])
def load_chat_file():
    data = request.get_json()
    filename = data.get("filename")
    if filename and state.load_chat_by_filename(filename):
        return jsonify({"success": True})
    return jsonify({"success": False}), 400

@app.route("/delete_chat_file", methods=["POST"])
def delete_chat_file():
    data = request.get_json()
    filename = data.get("filename")
    if filename:
        filepath = os.path.join("chats", filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            return jsonify({"success": True})
    return jsonify({"success": False}), 400

def init_bot():
    """Initialize chatbot with default PDF if available."""
    if not state.vectorstore and os.path.exists(state.DEFAULT_PDF):
        add_pdf(state.DEFAULT_PDF)
        rebuild_vectorstore()

if __name__ == "__main__":
    print("Initializing Gemini chatbot...")
    init_bot()
    print("Flask backend running at http://localhost:5000")
    print("Ready for React frontend connection!")
    app.run(debug=True, port=5000)
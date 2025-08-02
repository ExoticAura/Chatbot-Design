import os
import json
from dotenv import load_dotenv
from datetime import datetime
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain.chains import ConversationalRetrievalChain

# Always load .env first
load_dotenv()

# --- Cache Configuration ---
# Define directories for caching the processed search indexes.
# This dramatically speeds up app startup time on subsequent runs.
CACHE_DIR = "vectorstore_cache"
FAISS_CACHE_DIR = os.path.join(CACHE_DIR, "faiss_index")
BM25_CACHE_FILE = os.path.join(CACHE_DIR, "bm25_retriever.pkl")
os.makedirs(FAISS_CACHE_DIR, exist_ok=True) # Ensure the cache directory exists

# Load settings.json if it exists
SETTINGS_FILE = "settings.json"
if os.path.exists(SETTINGS_FILE):
    with open(SETTINGS_FILE, "r") as f:
        settings = json.load(f)
    api_key = settings.get("api_key") or os.getenv("GEMINI_API_KEY")
    model_name = settings.get("model_name", "gemini-1.5-flash")

    # Restrict to only allowed models
    if model_name not in ["gemini-1.5-flash", "gemini-2.0-flash"]:
        model_name = "gemini-1.5-flash"  # fallback
else:
    api_key = os.getenv("GEMINI_API_KEY") or ""
    model_name = "gemini-1.5-flash"

# Shared state
qa_chain = None
vectorstore = None
chat_history = []          # Current chat messages [(user, bot)]
last_bot_response = ""
files_data = {}            # {filename: {"path": path, "enabled": True/False}}
stop_response = False
last_suggestions = []
active_files_hash = None   # Stores a hash of the active files to check if rebuild is needed

DEFAULT_PDF = "Open_Source_Software_Best_Practices_and_Supply_Chain_Risk_Management.pdf"

# Check if API key exists
if not api_key:
    print("⚠️ GEMINI_API_KEY is missing. Please set it in .env or settings.json")

# Initialize Embeddings (needed by FAISS)
embeddings = GoogleGenerativeAIEmbeddings(
    model="models/embedding-001",
    google_api_key=api_key if api_key else None
)

# Initialize Suggestion LLM
suggestion_llm = ChatGoogleGenerativeAI(
    model=model_name,
    temperature=0.4,
    google_api_key=api_key if api_key else None
)

# Add memory storage (used by ConversationalRetrievalChain)
memory = None

# Add missing attributes
llm = suggestion_llm
qa_chain_class = ConversationalRetrievalChain

# === New structure for separate chat files ===
chats_folder = "chats"
os.makedirs(chats_folder, exist_ok=True)

# Track whether this is a new conversation or not
is_new_conversation = True
current_filename = ""

def save_current_chat():
    global is_new_conversation, current_filename

    if not os.path.exists("chats"):
        os.makedirs("chats")

    if is_new_conversation or not current_filename:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        current_filename = f"chats/{timestamp}.json"
        is_new_conversation = False

    with open(current_filename, "w", encoding="utf-8") as f:
        json.dump(chat_history, f, indent=2, ensure_ascii=False)

def start_new_chat():
    global chat_history, current_file
    chat_history = []
    current_file = None

def get_all_chat_files():
    return sorted(os.listdir(chats_folder))

def load_chat_by_filename(filename):
    global chat_history, current_file, is_new_conversation
    path = os.path.join(chats_folder, filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            chat_history = [tuple(pair) for pair in data]  # 🔧 Convert list to tuple
            current_file = filename
            is_new_conversation = False
            return True
    return False

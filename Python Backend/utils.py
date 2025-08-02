import os
import re
import pyttsx3
import threading
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Globals
tts_thread = None
tts_engine = None
is_reading = False

def load_pdf(pdf_path):
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
    loader = PyPDFLoader(pdf_path)
    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    return splitter.split_documents(docs)

def format_key_points(answer):
    cleaned = answer.replace("-\n", "-")
    cleaned = re.sub(r"(?<=[a-zA-Z])\n(?=[a-zA-Z])", "", cleaned)
    return cleaned.replace("•", "\n•")

def read_aloud_start(text):
    """
    Start reading the text. If it's already reading, stop and restart cleanly.
    """
    global tts_thread, is_reading

    def run_tts():
        global tts_engine, tts_thread, is_reading
        try:
            tts_engine = pyttsx3.init()
            tts_engine.say(text)
            is_reading = True
            tts_engine.runAndWait()
        except RuntimeError:
            # If engine is already running, skip gracefully
            pass
        finally:
            is_reading = False
            tts_engine.stop()
            tts_engine = None
            tts_thread = None  # Reset so we can read again

    # If it's already reading, stop first
    if tts_thread and tts_thread.is_alive():
        read_aloud_stop()
        tts_thread.join()

    # Launch new thread
    tts_thread = threading.Thread(target=run_tts, daemon=True)
    tts_thread.start()

def read_aloud_stop():
    """
    Stop ongoing speech completely.
    """
    global tts_engine, tts_thread, is_reading
    if tts_engine:
        try:
            tts_engine.stop()
        except RuntimeError:
            pass
    is_reading = False
    tts_thread = None

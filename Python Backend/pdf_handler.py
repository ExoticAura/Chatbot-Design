import os
import state
import pickle
import hashlib
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain.chains import ConversationalRetrievalChain
from langchain_google_genai import ChatGoogleGenerativeAI

def get_cache_path(files, extension):
    """Creates a unique hash for the current set of active files to use as a cache key."""
    # Create a stable string representation of the file list
    file_str = "".join(sorted([os.path.basename(f) for f in files]))
    # Hash the string to get a unique, fixed-length filename
    hash_key = hashlib.md5(file_str.encode()).hexdigest()
    return os.path.join(state.CACHE_DIR, f"{hash_key}.{extension}")

def rebuild_vectorstore():
    """
    Rebuilds the vector store and QA chain.
    It first checks for a cached version of the index for the current
    set of enabled PDFs. If found, it loads it. If not, it builds the
    index from scratch and saves it to the cache.
    """
    enabled_files = [data["path"] for data in state.files_data.values() if data["enabled"]]

    if not enabled_files:
        state.vectorstore = None
        state.qa_chain = None
        print("Knowledge base is empty. No PDFs are enabled.")
        return

    faiss_cache_path = get_cache_path(enabled_files, "faiss")
    bm25_cache_path = get_cache_path(enabled_files, "bm25.pkl")

    try:
        # --- Attempt to load from cache first ---
        if os.path.exists(faiss_cache_path) and os.path.exists(bm25_cache_path):
            print("Loading knowledge base from cache...")
            faiss_store = FAISS.load_local(
                faiss_cache_path, 
                state.embeddings, 
                allow_dangerous_deserialization=True # Required for FAISS
            )
            with open(bm25_cache_path, "rb") as f:
                bm25_retriever = pickle.load(f)
            print("Cache loaded successfully.")
        else:
            # --- If cache doesn't exist, build from scratch ---
            print("No cache found. Building new knowledge base...")
            documents = []
            for file_path in enabled_files:
                print(f" > Processing: {os.path.basename(file_path)}")
                loader = PyPDFLoader(file_path)
                documents.extend(loader.load())

            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            docs = text_splitter.split_documents(documents)

            # --- Create and save FAISS retriever ---
            print(" > Building FAISS index...")
            faiss_store = FAISS.from_documents(docs, state.embeddings)
            faiss_store.save_local(faiss_cache_path)

            # --- Create and save BM25 retriever ---
            print(" > Building BM25 index...")
            bm25_retriever = BM25Retriever.from_documents(docs)
            bm25_retriever.k = 4
            with open(bm25_cache_path, "wb") as f:
                pickle.dump(bm25_retriever, f)
            
            print("New knowledge base built and saved to cache.")

        # --- Combine retrievers ---
        faiss_retriever = faiss_store.as_retriever(search_kwargs={"k": 4})
        
        state.vectorstore = EnsembleRetriever(
            retrievers=[bm25_retriever, faiss_retriever],
            weights=[0.4, 0.6]
        )

        # --- Create Conversational QA chain ---
        llm = ChatGoogleGenerativeAI(
            model=state.model_name,
            temperature=0.2,
            google_api_key=state.api_key
        )
        state.qa_chain = ConversationalRetrievalChain.from_llm(
            llm=llm,
            retriever=state.vectorstore,
            return_source_documents=True
        )
        print("Chatbot is ready.")

    except Exception as e:
        print(f"❌ An error occurred during vectorstore rebuild: {e}")
        state.vectorstore = None
        state.qa_chain = None


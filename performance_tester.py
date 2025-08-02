import os
import time
import pickle
import shutil
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import state # To use existing state for models

# --- Configuration ---
# We will create dummy copies of your PDF to simulate a real-world scenario
# where you add multiple large files.
ORIGINAL_PDF = "Open_Source_Software_Best_Practices_and_Supply_Chain_Risk_Management.pdf"
NUM_COPIES = 5 # Let's test with 5 copies + the original
FAISS_CACHE_DIR = "faiss_index_cache"
BM25_CACHE_FILE = "bm25_retriever.pkl"
TEST_PDF_DIR = "test_pdfs"

def setup_test_files():
    """Creates a directory with copies of the original PDF for testing."""
    print(f"Setting up {NUM_COPIES+1} PDF files for the test...")
    if os.path.exists(TEST_PDF_DIR):
        shutil.rmtree(TEST_PDF_DIR)
    os.makedirs(TEST_PDF_DIR)

    if not os.path.exists(ORIGINAL_PDF):
        print(f"ERROR: The original PDF '{ORIGINAL_PDF}' was not found.")
        print("Please make sure it's in the same directory.")
        return []

    pdf_paths = [os.path.join(TEST_PDF_DIR, os.path.basename(ORIGINAL_PDF))]
    shutil.copy(ORIGINAL_PDF, pdf_paths[0])

    for i in range(NUM_COPIES):
        new_path = os.path.join(TEST_PDF_DIR, f"copy_{i+1}_{os.path.basename(ORIGINAL_PDF)}")
        shutil.copy(ORIGINAL_PDF, new_path)
        pdf_paths.append(new_path)
    
    print("Test files created.\n")
    return pdf_paths

def cleanup():
    """Removes the test files and cache directory."""
    print("\nCleaning up test files and cache...")
    if os.path.exists(TEST_PDF_DIR):
        shutil.rmtree(TEST_PDF_DIR)
    if os.path.exists(FAISS_CACHE_DIR):
        shutil.rmtree(FAISS_CACHE_DIR)
    if os.path.exists(BM25_CACHE_FILE):
        os.remove(BM25_CACHE_FILE)
    print("Cleanup complete.")

def run_current_version_test(pdf_paths):
    """
    Tests the performance of the current, inefficient method.
    This function re-processes every single PDF from scratch every time.
    """
    print("--- Running Test 1: Current Inefficient Method ---")
    start_time = time.time()

    documents = []
    for file_path in pdf_paths:
        loader = PyPDFLoader(file_path)
        documents.extend(loader.load())

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    docs = text_splitter.split_documents(documents)

    # This is the most expensive part: generating embeddings and building the index
    faiss_store = FAISS.from_documents(docs, state.embeddings)
    faiss_retriever = faiss_store.as_retriever(search_kwargs={"k": 4})
    
    bm25_retriever = BM25Retriever.from_documents(docs)
    bm25_retriever.k = 4
    
    # (Hybrid retriever creation is trivial and not timed)
    
    end_time = time.time()
    elapsed = end_time - start_time
    print(f"Result: The current method took {elapsed:.2f} seconds.")
    return elapsed

def run_cached_index_test():
    """
    Tests the performance of the proposed, efficient index caching method.
    This function loads the pre-built FAISS index and BM25 retriever from disk.
    """
    print("--- Running Test 2: Proposed Index Caching Method ---")
    start_time = time.time()
    
    # This is the key: loading the entire pre-built index is extremely fast.
    faiss_store = FAISS.load_local(FAISS_CACHE_DIR, state.embeddings, allow_dangerous_deserialization=True)
    faiss_retriever = faiss_store.as_retriever(search_kwargs={"k": 4})

    with open(BM25_CACHE_FILE, "rb") as f:
        bm25_retriever = pickle.load(f)

    # (Hybrid retriever creation is trivial and not timed)

    end_time = time.time()
    elapsed = end_time - start_time
    print(f"Result: The cached index method took {elapsed:.2f} seconds.")
    return elapsed
    
def build_cache(pdf_paths):
    """
    A one-time function to build and save the cache. This simulates the first run.
    """
    print("--- Building Cache for the First Time ---")
    start_time = time.time()
    
    documents = []
    for file_path in pdf_paths:
        loader = PyPDFLoader(file_path)
        documents.extend(loader.load())

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    docs = text_splitter.split_documents(documents)

    # Generate embeddings and build index (the slow part)
    faiss_store = FAISS.from_documents(docs, state.embeddings)
    
    # Save the completed index to disk
    faiss_store.save_local(FAISS_CACHE_DIR)

    # Build and save the BM25 retriever
    bm25_retriever = BM25Retriever.from_documents(docs)
    bm25_retriever.k = 4
    with open(BM25_CACHE_FILE, "wb") as f:
        pickle.dump(bm25_retriever, f)
        
    end_time = time.time()
    elapsed = end_time - start_time
    print(f"Result: Building the cache took {elapsed:.2f} seconds.")
    return elapsed


if __name__ == "__main__":
    test_files = setup_test_files()
    
    if test_files:
        # Run the tests
        current_time = run_current_version_test(test_files)
        build_time = build_cache(test_files)
        cached_time = run_cached_index_test()

        # Print a summary
        print("\n--- Performance Comparison Summary ---")
        print(f"Current Method (Rebuilds every time): {current_time:.2f} seconds")
        print(f"New Method (One-time build):          {build_time:.2f} seconds")
        print(f"New Method (Loading from cache):      {cached_time:.2f} seconds")
        
        improvement = current_time - cached_time
        if cached_time > 0:
            print(f"\nConclusion: Loading from a cached index is ~{improvement:.2f} seconds faster.")
            print("This is the true performance gain you'll feel when restarting the app.")

    cleanup()

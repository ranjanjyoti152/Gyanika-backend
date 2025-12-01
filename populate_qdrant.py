"""
Script to populate Qdrant with NCERT content from PDF files

Usage:
    1. Place PDF files in the 'ncert_books/' folder
    2. Run: python populate_qdrant.py
    
PDF Naming Convention:
    - class_9_science.pdf
    - class_10_mathematics.pdf
    - class_11_physics.pdf
"""
import os
import re
import requests
from pathlib import Path
from vector_store import get_vector_store

# Doculing service configuration
DOCULING_URL = os.getenv("DOCULING_URL", "http://192.168.101.66:5001")

try:
    import PyPDF2
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    print("⚠️  PyPDF2 not installed. Install it with: pip install PyPDF2")

def extract_metadata_from_filename(filename: str):
    """
    Extract class and subject from filename
    Expected format: class_[NUMBER]_[SUBJECT].pdf
    """
    # Remove .pdf extension
    name = filename.replace('.pdf', '').replace('.PDF', '')
    
    # Try to match pattern: class_10_mathematics
    match = re.match(r'class[_\s-]?(\d+)[_\s-]?(.*)', name, re.IGNORECASE)
    
    if match:
        class_num = int(match.group(1))
        subject = match.group(2).replace('_', ' ').replace('-', ' ').title()
        return class_num, subject
    
    # Default values if pattern doesn't match
    return None, name.replace('_', ' ').title()

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text content from a PDF file using Doculing service"""
    
    # Try Doculing first (preferred method for better extraction)
    try:
        print(f"   🔄 Sending to Doculing for extraction...")
        with open(pdf_path, 'rb') as f:
            files = {'file': (os.path.basename(pdf_path), f, 'application/pdf')}
            response = requests.post(
                f"{DOCULING_URL}/extract",
                files=files,
                timeout=120  # 2 minutes timeout for large PDFs
            )
            response.raise_for_status()
            data = response.json()
            
            # Doculing should return extracted text
            if isinstance(data, dict) and 'text' in data:
                text = data['text']
                word_count = len(text.split())
                print(f"   ✅ Doculing extracted {word_count:,} words")
                return text
            elif isinstance(data, str):
                return data
            else:
                print(f"   ⚠️  Unexpected Doculing response format")
    
    except requests.exceptions.RequestException as e:
        print(f"   ⚠️  Doculing service unavailable: {e}")
    except Exception as e:
        print(f"   ⚠️  Doculing extraction error: {e}")
    
    # Fallback to PyPDF2 if Doculing fails
    if not PDF_SUPPORT:
        print(f"   ❌ PyPDF2 not available for fallback extraction")
        return ""
    
    try:
        print(f"   📄 Using PyPDF2 fallback extraction...")
        text = ""
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            total_pages = len(pdf_reader.pages)
            
            print(f"   📄 Processing {total_pages} pages...")
            
            for page_num, page in enumerate(pdf_reader.pages, 1):
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                
                # Show progress for large PDFs
                if page_num % 10 == 0:
                    print(f"   ⏳ Processed {page_num}/{total_pages} pages...")
        
        return text.strip()
    except Exception as e:
        print(f"   ❌ Error extracting text from PDF: {e}")
        return ""

def load_pdfs_from_folder(folder_path: str = "./ncert_books"):
    """
    Load all PDF files from the specified folder and add to Qdrant
    """
    folder = Path(folder_path)
    
    if not folder.exists():
        print(f"❌ Folder not found: {folder_path}")
        print("Creating folder...")
        folder.mkdir(parents=True, exist_ok=True)
        print(f"✅ Created folder: {folder_path}")
        print(f"\n💡 Place your PDF files in '{folder_path}' and run this script again.")
        return
    
    # Find all PDF files
    pdf_files = list(folder.glob("*.pdf")) + list(folder.glob("*.PDF"))
    
    if not pdf_files:
        print(f"\n📂 No PDF files found in '{folder_path}'")
        print(f"\n💡 Add PDF files with this naming convention:")
        print("   - class_9_science.pdf")
        print("   - class_10_mathematics.pdf")
        print("   - class_11_physics.pdf")
        return
    
    print(f"\n📚 Found {len(pdf_files)} PDF file(s) in '{folder_path}'")
    print("=" * 60)
    
    vs = get_vector_store()
    total_processed = 0
    total_failed = 0
    
    for pdf_file in pdf_files:
        print(f"\n📖 Processing: {pdf_file.name}")
        
        # Extract metadata from filename
        class_num, subject = extract_metadata_from_filename(pdf_file.name)
        
        if class_num:
            print(f"   📌 Detected: Class {class_num} - {subject}")
        else:
            print(f"   📌 Subject: {subject} (No class detected)")
        
        # Extract text from PDF
        text = extract_text_from_pdf(str(pdf_file))
        
        if not text:
            print(f"   ❌ Failed to extract text from {pdf_file.name}")
            total_failed += 1
            continue
        
        # Get text statistics
        word_count = len(text.split())
        char_count = len(text)
        print(f"   📊 Extracted: {word_count:,} words ({char_count:,} characters)")
        
        # Add to Qdrant
        try:
            success = vs.add_ncert_content(
                content=text,
                class_num=class_num or 0,  # Use 0 if class not detected
                subject=subject,
                chapter=pdf_file.stem,  # Use filename as chapter name
                chapter_num=0,
                topic=None,
                additional_metadata={
                    "filename": pdf_file.name,
                    "file_path": str(pdf_file),
                    "word_count": word_count
                }
            )
            
            if success:
                print(f"   ✅ Successfully added to Gyanika's knowledge base!")
                total_processed += 1
            else:
                print(f"   ❌ Failed to add to database")
                total_failed += 1
        
        except Exception as e:
            print(f"   ❌ Error: {e}")
            total_failed += 1
    
    print("\n" + "=" * 60)
    print(f"\n📊 Summary:")
    print(f"   ✅ Successfully processed: {total_processed} file(s)")
    if total_failed > 0:
        print(f"   ❌ Failed: {total_failed} file(s)")
    print(f"\n🎉 Gyanika's knowledge base has been updated!")
    print(f"💡 You can now ask questions about the content in these PDFs.")

def populate_sample_content():
    """Add sample NCERT content"""
    print("Initializing Qdrant vector store...")
    vs = get_vector_store()
    
    print("\n📚 Adding Class 10 Science content...")
    
    # Sample Class 10 Science - Photosynthesis
    photosynthesis_content = """
    Photosynthesis is the process by which green plants and some other organisms 
    use sunlight to synthesize foods with the help of chlorophyll pigments. 
    During photosynthesis in green plants, light energy is captured and used to 
    convert water, carbon dioxide, and minerals into oxygen and energy-rich organic compounds.
    
    The equation: 6CO2 + 6H2O + Light Energy → C6H12O6 + 6O2
    
    This process occurs in two stages:
    1. Light-dependent reactions (in thylakoids): Light energy is converted to chemical energy (ATP and NADPH)
    2. Light-independent reactions (Calvin cycle in stroma): Carbon dioxide is fixed into glucose using ATP and NADPH
    
    Factors affecting photosynthesis:
    - Light intensity
    - Carbon dioxide concentration
    - Temperature
    - Water availability
    - Chlorophyll content
    """
    
    vs.add_ncert_content(
        content=photosynthesis_content,
        class_num=10,
        subject="Science",
        chapter="Life Processes",
        chapter_num=6,
        topic="Photosynthesis"
    )
    
    # Sample Class 10 Science - Respiration
    respiration_content = """
    Respiration in organisms is the process of releasing energy from food molecules.
    It is a biochemical process that occurs in cells. During respiration, organic compounds
    like glucose are broken down to provide energy in the form of ATP.
    
    Types of respiration:
    
    1. Aerobic respiration (with oxygen): 
       C6H12O6 + 6O2 → 6CO2 + 6H2O + Energy (36-38 ATP)
       - Occurs in mitochondria
       - Complete breakdown of glucose
       - Produces maximum energy
    
    2. Anaerobic respiration (without oxygen):
       - In muscles: Glucose → Lactic acid + Energy (2 ATP)
       - In yeast: Glucose → Ethanol + CO2 + Energy (2 ATP)
    
    The human respiratory system includes:
    - Nostrils and nasal cavity
    - Pharynx and Larynx
    - Trachea and Bronchi
    - Bronchioles and Alveoli (site of gas exchange)
    """
    
    vs.add_ncert_content(
        content=respiration_content,
        class_num=10,
        subject="Science",
        chapter="Life Processes",
        chapter_num=6,
        topic="Respiration"
    )
    
    print("✅ Class 10 Science content added")
    
    print("\n📐 Adding Class 10 Mathematics content...")
    
    # Sample Class 10 Mathematics - Quadratic Equations
    quadratic_content = """
    Quadratic Equations: A quadratic equation in the variable x is an equation of the form
    ax² + bx + c = 0, where a, b, c are real numbers and a ≠ 0.
    
    Methods to solve quadratic equations:
    
    1. Factorisation method:
       - Express the equation as product of two linear factors
       - Example: x² - 5x + 6 = 0 can be written as (x-2)(x-3) = 0
       - Solutions: x = 2 or x = 3
    
    2. Completing the square method:
       - Add and subtract (b/2a)² to make a perfect square
       - Convert to the form (x + p)² = q
    
    3. Quadratic formula:
       x = [-b ± √(b² - 4ac)] / 2a
       This gives both roots directly
    
    Nature of roots (discriminant D = b² - 4ac):
    - If D > 0: Two distinct real roots
    - If D = 0: Two equal real roots (repeated root)
    - If D < 0: No real roots (complex roots)
    
    Applications:
    - Finding dimensions when area is given
    - Profit and loss problems
    - Time and work problems
    - Motion problems
    """
    
    vs.add_ncert_content(
        content=quadratic_content,
        class_num=10,
        subject="Mathematics",
        chapter="Quadratic Equations",
        chapter_num=4,
        topic="Solving Quadratic Equations"
    )
    
    print("✅ Class 10 Mathematics content added")
    
    print("\n🌍 Adding Class 10 Social Science content...")
    
    # Sample Class 10 Social Science - French Revolution
    french_revolution_content = """
    The French Revolution (1789-1799) was a period of radical social and political upheaval in France.
    
    Causes of the French Revolution:
    
    1. Social Inequality:
       - Three Estates: Clergy (First), Nobility (Second), Common people (Third)
       - Third Estate paid all taxes but had no privileges
       - 90% of population was Third Estate
    
    2. Economic Crisis:
       - France was bankrupt due to wars
       - Poor harvests led to bread shortage
       - Rising bread prices caused unrest
    
    3. Political Causes:
       - Absolute monarchy under Louis XVI
       - No representation for common people
       - Influence of Enlightenment ideas (Rousseau, Montesquieu, Voltaire)
    
    Key Events:
    - 1789: Storming of Bastille (July 14)
    - Declaration of Rights of Man and Citizen
    - 1792: France became a Republic
    - 1793-94: Reign of Terror under Robespierre
    - 1799: Napoleon Bonaparte came to power
    
    Impact:
    - End of feudalism in France
    - Spread of ideas of liberty, equality, and fraternity
    - Rise of nationalism
    - Influence on other revolutions worldwide
    """
    
    vs.add_ncert_content(
        content=french_revolution_content,
        class_num=10,
        subject="Social Science",
        chapter="The French Revolution",
        chapter_num=1,
        topic="Causes and Events"
    )
    
    print("✅ Class 10 Social Science content added")
    
    print("\n🎉 Sample NCERT content populated successfully!")
    print("\n💡 You can now ask Gyanika questions like:")
    print("   - 'Explain photosynthesis'")
    print("   - 'How to solve quadratic equations?'")
    print("   - 'What caused the French Revolution?'")
    print("\n🔍 The vector database will find relevant content to answer your questions!")

if __name__ == "__main__":
    import sys
    
    print("=" * 60)
    print("  📚 GYANIKA - Knowledge Base Updater")
    print("=" * 60)
    
    if not PDF_SUPPORT:
        print("\n❌ PyPDF2 is required to process PDF files")
        print("Install it with: pip install PyPDF2")
        sys.exit(1)
    
    try:
        print("\n🔍 Checking Qdrant connection...")
        vs = get_vector_store()
        print("✅ Connected to Qdrant vector database")
        
        # Ask user what they want to do
        print("\nWhat would you like to do?")
        print("1. Load PDFs from 'ncert_books/' folder (Recommended)")
        print("2. Add sample content for testing")
        
        choice = input("\nEnter your choice (1 or 2): ").strip()
        
        if choice == "1":
            load_pdfs_from_folder("./ncert_books")
        elif choice == "2":
            print("\n📝 Adding sample content...")
            populate_sample_content()
        else:
            print("Invalid choice. Defaulting to loading PDFs...")
            load_pdfs_from_folder("./ncert_books")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nMake sure:")
        print("1. Qdrant is running at http://10.10.18.161:6333")
        print("2. All dependencies are installed:")
        print("   pip install qdrant-client sentence-transformers PyPDF2")

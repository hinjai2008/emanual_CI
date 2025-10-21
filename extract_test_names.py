import PyPDF2

# Path to the PDF file
pdf_path = "c:/Users/raypc/Desktop/protected (1)/eManual/testList.pdf"

# Extract text from the PDF
def extract_test_names(pdf_path):
    test_names = []
    try:
        with open(pdf_path, "rb") as file:
            reader = PyPDF2.PdfReader(file)
            for page in reader.pages:
                text = page.extract_text()
                lines = text.split("\n")
                for line in lines:
                    if line.strip():
                        test_names.append(line.strip())
    except Exception as e:
        print(f"Error reading PDF: {e}")
    return test_names

# Extract and print test names
test_names = extract_test_names(pdf_path)
for name in test_names:
    print(name)
import gspread
import json
import os
import re
import subprocess
import io
import openpyxl
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# --- CONFIG ---
CREDENTIALS_FILE = "credentials.json"
RESPONSES_SPREADSHEET_ID = "15Ub8Ci0Djg4u2QpnLKRcNCp88UUb6RcFdeKwx6D2zIc"
RESPONSES_SHEET_GID = "1704672789"
JSON_FILE = os.path.join("main_content", "overall_mappings.json")
REPO_DIR = os.path.dirname(os.path.abspath(__file__))

# Google API scopes
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def get_google_credentials():
    creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
    return creds


def find_column(headers, keyword):
    for i, h in enumerate(headers):
        if keyword.lower() in h.lower():
            return i
    return None


def read_responses(creds):
    gc = gspread.authorize(creds)
    spreadsheet = gc.open_by_key(RESPONSES_SPREADSHEET_ID)
    worksheet = spreadsheet.get_worksheet(0)
    rows = worksheet.get_all_values()
    if len(rows) <= 1:
        print("No responses found.")
        return []
    headers = [h.strip() for h in rows[0]]

    drive_col = find_column(headers, "upload")
    responses = []
    for row in rows[1:]:
        if not row or not any(row):
            continue
        entry = {
            "name": row[find_column(headers, "name")] if find_column(headers, "name") is not None else "",
            "department": row[find_column(headers, "department")] if find_column(headers, "department") is not None else "",
            "university": row[find_column(headers, "university going")] if find_column(headers, "university going") is not None else "",
            "drive_link": row[drive_col] if drive_col is not None and drive_col < len(row) else "",
        }
        responses.append(entry)
    return responses


def extract_drive_file_id(url):
    match = re.search(r'id=([a-zA-Z0-9_-]+)', url)
    if match:
        return match.group(1)
    match = re.search(r'/d/([a-zA-Z0-9_-]+)', url)
    if match:
        return match.group(1)
    return None


def download_excel_from_drive(creds, file_id):
    service = build("drive", "v3", credentials=creds)
    request = service.files().get_media(fileId=file_id)
    file_stream = io.BytesIO()
    downloader = MediaIoBaseDownload(file_stream, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    file_stream.seek(0)
    return file_stream


def parse_excel(file_stream):
    wb = openpyxl.load_workbook(file_stream, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) <= 1:
        return []
    raw_headers = [str(h).strip() if h else "" for h in rows[0]]

    def find_col(keyword):
        for i, h in enumerate(raw_headers):
            if keyword.lower() in h.lower():
                return i
        return None

    courses = []
    for row in rows[1:]:
        if not row or not any(row):
            continue
        entry = {
            "IITB Course Code": row[find_col("iitb course code")] if find_col("iitb course code") is not None and find_col("iitb course code") < len(row) else "",
            "IITB Course Name": row[find_col("iitb course name")] if find_col("iitb course name") is not None and find_col("iitb course name") < len(row) else "",
            "IIT Course Description": row[find_col("iit course description")] if find_col("iit course description") is not None and find_col("iit course description") < len(row) else "",
            "Corresponding Foreign University Course Code and Name": row[find_col("corresponding foreign")] if find_col("corresponding foreign") is not None and find_col("corresponding foreign") < len(row) else "",
            "Foreign University Course Description": row[find_col("foreign university course description")] if find_col("foreign university course description") is not None and find_col("foreign university course description") < len(row) else "",
            "Foreign University Name": row[find_col("foreign university name")] if find_col("foreign university name") is not None and find_col("foreign university name") < len(row) else "",
            "Department": row[find_col("department")] if find_col("department") is not None and find_col("department") < len(row) else "",
            "Country": row[find_col("country")] if find_col("country") is not None and find_col("country") < len(row) else "",
            "Credits(IITB)": row[find_col("credits(iitb)")] if find_col("credits(iitb)") is not None and find_col("credits(iitb)") < len(row) else 0,
            "Credits(Foreign University)": row[find_col("credits(foreign")] if find_col("credits(foreign") is not None and find_col("credits(foreign") < len(row) else 0,
        }
        courses.append(entry)
    return courses


def excel_entry_to_json(entry):
    course_code = str(entry.get("IITB Course Code", "")).strip()
    course_name = str(entry.get("IITB Course Name", "")).strip()
    iitb_course = f"{course_code} - {course_name}" if course_code and course_name else course_code or course_name

    foreign_code_name = str(entry.get("Corresponding Foreign University Course Code and Name", "")).strip()

    iitb_credits = entry.get("Credits(IITB)", 0)
    try:
        iitb_credits = int(iitb_credits)
    except (ValueError, TypeError):
        iitb_credits = 0

    foreign_credits = entry.get("Credits(Foreign University)", 0)
    try:
        foreign_credits = int(foreign_credits)
    except (ValueError, TypeError):
        foreign_credits = 0

    return {
        "IITB Course (code-name)": iitb_course,
        "Foreign Course (code-name)": foreign_code_name,
        "Credits(Foreign Course)": foreign_credits,
        "Department of Student": str(entry.get("Department", "")).strip(),
        "Foreign University Name": str(entry.get("Foreign University Name", "")).strip(),
        "Foreign Course Description": str(entry.get("Foreign University Course Description", "")).strip(),
        "IITB Course Descriptions": str(entry.get("IIT Course Description", "")).strip(),
        "Country": str(entry.get("Country", "")).strip(),
        "IITB Course Credits": iitb_credits,
    }


def load_existing_json():
    if os.path.exists(JSON_FILE):
        with open(JSON_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_json(data):
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def is_duplicate(existing, new_entry):
    for item in existing:
        if (item.get("IITB Course (code-name)") == new_entry.get("IITB Course (code-name)") and
            item.get("Foreign University Name") == new_entry.get("Foreign University Name") and
            item.get("Foreign Course (code-name)") == new_entry.get("Foreign Course (code-name)")):
            return True
    return False


def git_push(commit_message):
    try:
        subprocess.run(["git", "add", "."], cwd=REPO_DIR, check=True)
        result = subprocess.run(["git", "status", "--porcelain"], cwd=REPO_DIR, capture_output=True, text=True)
        if result.stdout.strip():
            subprocess.run(["git", "commit", "-m", commit_message], cwd=REPO_DIR, check=True)
            subprocess.run(["git", "push", "origin", "main"], cwd=REPO_DIR, check=True)
            print("Changes pushed to GitHub successfully.")
        else:
            print("No changes to commit.")
    except subprocess.CalledProcessError as e:
        print(f"Git error: {e}")


def main():
    print("Starting automation...")
    creds = get_google_credentials()

    print("Reading responses from Google Sheet...")
    responses = read_responses(creds)
    print(f"Found {len(responses)} response(s).")

    existing_data = load_existing_json()
    new_count = 0

    for i, response in enumerate(responses):
        drive_link = response.get("drive_link", "")
        if not drive_link:
            print(f"Row {i+2}: No Drive link found, skipping.")
            continue

        file_id = extract_drive_file_id(drive_link)
        if not file_id:
            print(f"Row {i+2}: Could not extract file ID from link, skipping.")
            continue

        print(f"Row {i+2}: Downloading file {file_id}...")
        try:
            file_stream = download_excel_from_drive(creds, file_id)
        except Exception as e:
            print(f"Row {i+2}: Error downloading file: {e}")
            continue

        print(f"Row {i+2}: Parsing Excel file...")
        try:
            courses = parse_excel(file_stream)
        except Exception as e:
            print(f"Row {i+2}: Error parsing Excel: {e}")
            continue

        for course in courses:
            json_entry = excel_entry_to_json(course)
            if not is_duplicate(existing_data, json_entry):
                existing_data.append(json_entry)
                new_count += 1
                print(f"  Added: {json_entry['IITB Course (code-name)']}")
            else:
                print(f"  Skipped (duplicate): {json_entry['IITB Course (code-name)']}")

    print(f"\nTotal new courses added: {new_count}")

    if new_count > 0:
        save_json(existing_data)
        print("JSON file updated.")
        git_push(f"automation: update overall_mappings.json with {new_count} new course(s)")
    else:
        print("No new courses to add.")


if __name__ == "__main__":
    main()

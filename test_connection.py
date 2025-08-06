import sys
print("Python is working!")
print(f"Python version: {sys.version}")

try:
    import psycopg2
    print("psycopg2 imported successfully")
    
    from dotenv import load_dotenv
    print("dotenv imported successfully")
    
    import os
    load_dotenv('config.env')
    
    DB_CONFIG = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': os.getenv('DB_PORT', '5432'),
        'database': os.getenv('DB_NAME', 'diary'),
        'user': os.getenv('DB_USER', 'diary_user'),
        'password': os.getenv('DB_PASSWORD', 'diary123')
    }
    
    print(f"DB Config: {DB_CONFIG}")
    
    conn = psycopg2.connect(**DB_CONFIG)
    print("Database connection successful!")
    
    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    version = cursor.fetchone()
    print(f"PostgreSQL version: {version[0]}")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
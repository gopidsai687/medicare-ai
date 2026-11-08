import sqlite3

def run():
    conn = sqlite3.connect('backend/medicare.db')
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_keys=OFF;")

    # Check current schema
    cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='prescriptions';")
    row = cur.fetchone()
    if not row:
        print("Table prescriptions not found")
        return

    old_sql = row[0]
    # Replace "doctor_id VARCHAR(32) NOT NULL" with "doctor_id VARCHAR(32)"
    new_sql = old_sql.replace("doctor_id VARCHAR(32) NOT NULL", "doctor_id VARCHAR(32)")
    new_sql = new_sql.replace("doctor_id CHAR(32) NOT NULL", "doctor_id CHAR(32)")
    new_sql = new_sql.replace("doctor_id GUID NOT NULL", "doctor_id GUID")

    cur.execute("BEGIN TRANSACTION;")
    cur.execute("ALTER TABLE prescriptions RENAME TO prescriptions_old;")
    cur.execute(new_sql)
    # Copy data
    cur.execute("PRAGMA table_info(prescriptions);")
    cols = [r[1] for r in cur.fetchall()]
    cols_str = ", ".join(cols)
    cur.execute(f"INSERT INTO prescriptions ({cols_str}) SELECT {cols_str} FROM prescriptions_old;")
    cur.execute("DROP TABLE prescriptions_old;")
    cur.execute("COMMIT;")
    cur.execute("PRAGMA foreign_keys=ON;")
    conn.close()
    print("Successfully made doctor_id nullable in prescriptions table.")

if __name__ == '__main__':
    run()


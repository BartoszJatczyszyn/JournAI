#!/usr/bin/env python3
"""
Simple script to run the fixed migration
"""

if __name__ == "__main__":
    print("Starting Garmin migration...")
    
    try:
        from enhanced_migration import EnhancedGarminMigrator
        
        migrator = EnhancedGarminMigrator()
        migrator.run_migration()
        
        print("Migration completed!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        print(f"Error type: {type(e).__name__}")
        
        # Print helpful error messages
        error_str = str(e).lower()
        if "integer out of range" in error_str:
            print("This error should be fixed with the BigInteger updates")
        elif "connection" in error_str:
            print("Check PostgreSQL connection and config.env")
        elif "permission" in error_str:
            print("Check database permissions")
        
        raise
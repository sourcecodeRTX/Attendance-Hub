const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ykvjxexmgjvpcvzakwnm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlrdmp4ZXhtZ2p2cGN2emFrd25tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQ4Mjg3NiwiZXhwIjoyMDg5MDU4ODc2fQ.WnhaxSkS6bbNNG9lJSNuJeV4BK0gQkWo43GDaRYytF8';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function clearData() {
  console.log('--- STARTING DATA CLEAR (ONLY ROWS, NO TABLES DROPPED) ---');
  
  // 1. Delete all auth users
  console.log('Clearing auth.users...');
  let hasMore = true;
  let page = 1;
  let deletedCount = 0;
  while(hasMore) {
      const { data: users, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
          console.error(error);
          break;
      }
      if (users.users.length === 0) {
          hasMore = false;
          break;
      }
      for (const user of users.users) {
          await supabase.auth.admin.deleteUser(user.id);
          deletedCount++;
      }
  }
  console.log(`Deleted ${deletedCount} users from authentication.`);

  // 2. Delete data from tables (bottom up to avoid foreign key errors)
  const tablesToClear = [
      'activity_logs',
      'student_attendance',
      'students',
      'user_subjects',
      'user_sections',
      'subject_sections',
      'subjects',
      'sections',
      'specialisations',
      'branches',
      'departments',
      'users',
      'universities'
  ];

  for (const table of tablesToClear) {
      console.log(`Clearing table: ${table}...`);
      // Delete all rows where id is not null (which means all rows)
      const { error } = await supabase.from(table).delete().not('id', 'is', null);
      if (error) {
          console.log(`  - Error or empty: ${error.message}`);
      } else {
          console.log(`  - Cleared ${table}`);
      }
  }

  console.log('--- DATA CLEAR COMPLETE ---');
}

clearData();

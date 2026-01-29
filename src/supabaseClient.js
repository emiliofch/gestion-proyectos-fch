import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bisccrlqcixkaguspntw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpc2NjcmxxY2l4a2FndXNwbnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzA5MTMsImV4cCI6MjA4NTAwNjkxM30.VU4obOq-oceRK7-rdwzDT9XB98XL_O-z7xRhxqS_H8Y'

export const supabase = createClient(supabaseUrl, supabaseKey)

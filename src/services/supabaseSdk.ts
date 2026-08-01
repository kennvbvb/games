// Sole purpose: give the lazily-loaded Supabase chunk a recognisable filename.
// Importing the package directly names the chunk after its own entry file
// ("dist-<hash>.js"), which is meaningless in a network waterfall.
export { createClient } from '@supabase/supabase-js'

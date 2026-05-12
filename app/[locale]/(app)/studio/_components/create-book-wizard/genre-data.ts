export const GENRES: Record<string, string[]> = {
  'Fantasy': ['Epic Fantasy', 'Urban Fantasy', 'Dark Fantasy', 'High Fantasy', 'LitRPG', 'Portal Fantasy'],
  'Science Fiction': ['Space Opera', 'Hard SF', 'Cyberpunk', 'Solarpunk', 'Military SF', 'Biopunk'],
  'Thriller': ['Psychological', 'Legal', 'Medical', 'Political', 'Techno-Thriller', 'Spy'],
  'Mystery': ['Cozy Mystery', 'Hard-Boiled', 'Police Procedural', 'Amateur Sleuth', 'Noir'],
  'Romance': ['Contemporary', 'Historical', 'Paranormal', 'Romantic Suspense', 'Fantasy Romance'],
  'Horror': ['Psychological', 'Supernatural', 'Gothic', 'Body Horror', 'Cosmic Horror'],
  'Historical Fiction': ['Ancient World', 'Medieval', 'Victorian', 'WWI/WWII', 'American West'],
  'Literary Fiction': ['Contemporary', 'Experimental', 'Satire', 'Southern Gothic'],
  'Non-fiction': ['Business', 'History', 'Science', 'True Crime', 'Essay Collection', 'Travel'],
  'Memoir': ['Personal Essay', 'Celebrity', 'Trauma & Recovery', 'Coming-of-Age'],
  "Children's": ['Picture Book', 'Early Reader', 'Chapter Book'],
  'Graphic Novel / Comics': ['Superhero', 'Slice of Life', 'Fantasy', 'Horror', 'Memoir'],
}

export const GENRE_NAMES = Object.keys(GENRES)

export const CONTENT_WARNINGS = [
  'Violence', 'Sexual Content', 'Strong Language', 'Substance Abuse',
  'Mental Health', 'Death & Grief', 'Abuse', 'War & Conflict', 'Animal Harm',
]

export const TRIM_SIZES = ['5×8', '6×9', '7×10', '8.5×11', 'A4', 'A5']

export const TARGET_AUDIENCES = ['Adult', 'YA', 'MG', "Children's"]

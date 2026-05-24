// Pod Types = the intent / format of the pod — "what are we doing together?"
// Pod Categories = the topic / domain — "what is the pod about?"
// Both are structured multi-selects surfaced on Create + Feed filters.

export const POD_TYPES = [
  'Accountability',
  'Business',
  'Career Development',
  'Co-founders',
  'Discussion',
  'Education',
  'Explore',
  'Friends',
  'Fun',
  'Hangout',
  'Hobby',
  'Mentorship',
  'Networking',
  'New Endeavor',
  'Personal Growth',
  'Problem Solving',
  'Relax',
  'Side Hustle',
  'Socialize',
  'Start-Ups',
  'Support',
].sort();

export const POD_CATEGORIES = [
  'AI',
  'Architecture',
  'Art',
  'Coding',
  'Design',
  'Finance',
  'Fitness',
  'Games',
  'Health',
  'Investing',
  'Lifestyle',
  'Marketing',
  'Medical',
  'Mental Health',
  'Mindfulness',
  'Mobile App',
  'Music',
  'Nature',
  'Outdoors',
  'Productivity',
  'Religion',
  'Web App',
  'Social Media',
  'Spiritual',
  'Sport',
  'Technology',
  'Travel',
  'Vibe Coding',
  'Yoga',
].sort();

// Back-compat alias — older code imports PURSUIT_TYPES. Keep exporting the union
// so nothing breaks until every call-site is migrated.
export const PURSUIT_TYPES = [...POD_TYPES, ...POD_CATEGORIES].sort();

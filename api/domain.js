/**
 * Domain restriction: kitchen, cooking, food topics only.
 * Supports multiple languages (EN, ID, etc.).
 * Returns { allowed: boolean, message?: string }.
 */

const COOKING_INDICATORS = [
  // English
  'cook', 'cooking', 'kitchen', 'recipe', 'food', 'ingredient', 'meal', 'dish',
  'bake', 'fry', 'boil', 'grill', 'roast', 'sauté', 'sauce', 'seasoning',
  'chef', 'culinary', 'cuisine', 'menu', 'prep', 'preparation', 'knife',
  'oven', 'stove', 'pan', 'pot', 'baking', 'pastry', 'dough', 'broth',
  'vegetable', 'meat', 'fish', 'dairy', 'herb', 'spice', 'taste', 'flavor',
  'restaurant', 'catering', 'nutrition', 'diet', 'breakfast', 'lunch', 'dinner',
  'dessert', 'appetizer', 'soup', 'salad', 'stock', 'marinate', 'glaze',
  'how to', 'what is', 'substitute', 'temperature', 'timer', 'storage',
  'rice', 'noodle', 'pasta', 'bread', 'flour', 'sugar', 'salt', 'oil',
  // Indonesian
  'nasi', 'goreng', 'masak', 'memasak', 'masakan', 'makanan', 'resep', 'cara',
  'tumis', 'rebus', 'panggang', 'kukus', 'sambal', 'rendang', 'sate', 'bakso',
  'mie', 'roti', 'sayur', 'daging', 'ayam', 'ikan', 'bumbu', 'rempah',
  'santan', 'kecap', 'garam', 'gula', 'merica', 'bawang', 'cabai', 'cabai',
  'tempe', 'tahu', 'telur', 'soto', 'gulai', 'opor', 'rawon', 'sop',
  'kue', 'kering', 'gorengan', 'kerupuk', 'sambal', 'lalapan',
  // Spanish / Portuguese
  'cocinar', 'receta', 'comida', 'ingrediente', 'arroz', 'carne', 'pescado',
  // French
  'cuisiner', 'recette', 'cuisine', 'aliment',
  // Generic food terms (many languages)
  'rice', 'noodle', 'meat', 'chicken', 'fish', 'egg', 'vegetable', 'sauce',
  'spice', 'flour', 'sugar', 'salt', 'oil', 'butter', 'milk'
];

const DENIED_MESSAGE = 'I\'m ChefBot, and I only answer questions about the kitchen and professional cooking. Please ask me something culinary—recipes, techniques, ingredients, or kitchen tips—and I\'ll be happy to help!';

/**
 * Question starters that suggest culinary intent (multi-language)
 */
const QUESTION_STARTERS = [
  'how', 'what', 'why', 'when', 'where', 'which', 'can', 'could', 'would',
  'bagaimana', 'apa', 'kenapa', 'mengapa', 'kapan', 'dimana', 'bisa', 'boleh',
  'cómo', 'qué', 'por qué', 'comment', 'quoi', 'wie', 'was'
];

/**
 * Lightweight check: does the user message appear to be about cooking/food/kitchen?
 * @param {string} text - User message
 * @returns {{ allowed: boolean, message?: string }}
 */
function checkDomain(text) {
  if (!text || typeof text !== 'string') {
    return { allowed: false, message: DENIED_MESSAGE };
  }
  const normalized = text.toLowerCase().trim();
  if (normalized.length < 2) {
    return { allowed: false, message: DENIED_MESSAGE };
  }
  // Check cooking/food keywords
  const hasCookingTerm = COOKING_INDICATORS.some(term => normalized.includes(term));
  if (hasCookingTerm) {
    return { allowed: true };
  }
  // Allow question starters that often precede culinary questions
  const startsWithQuestion = QUESTION_STARTERS.some(q => normalized.startsWith(q + ' ') || normalized === q);
  if (startsWithQuestion && normalized.length > 10) {
    return { allowed: true };
  }
  // Allow short clarifying or greeting phrases
  const shortGeneric = /^(hi|hello|hey|halo|hai|thanks|thank you|terima kasih|ok|ya|tidak|please|tolong|help|bantu|what|how|apa|bagaimana|explain|jelaskan)$/i;
  if (shortGeneric.test(normalized)) {
    return { allowed: true };
  }
  return { allowed: false, message: DENIED_MESSAGE };
}

module.exports = { checkDomain, DENIED_MESSAGE };

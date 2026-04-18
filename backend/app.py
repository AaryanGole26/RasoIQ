from flask import Flask, request, jsonify
from flask_cors import CORS
from recommender import RecipeRecommender
import os

app = Flask(__name__)
CORS(app)

# Initialize recommender with local fallback data path
FALLBACK_DATA = os.path.join(os.path.dirname(__file__), 'data', 'recipes.json')
recommender = RecipeRecommender(FALLBACK_DATA)

@app.route('/recommend', methods=['POST'])
def recommend():
    data = request.json
    ingredients = data.get('ingredients', [])
    diet = data.get('diet', 'any')
    cuisine = data.get('cuisine', 'any')
    offset = data.get('offset', 0)
    
    if not ingredients:
        return jsonify({"error": "No ingredients provided"}), 400
    
    results = recommender.get_recommendations(ingredients, diet, cuisine, offset)
    return jsonify({"status": "success", "recipes": results})

@app.route('/recipe/<int:recipe_id>/details', methods=['GET'])
def recipe_details(recipe_id):
    """Fetch extended details (instructions) for a Spoonacular recipe."""
    try:
        details = recommender.get_instructions(recipe_id)
        return jsonify({"status": "success", "details": details})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "api_key_configured": bool(os.getenv('SPOONACULAR_API_KEY'))}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

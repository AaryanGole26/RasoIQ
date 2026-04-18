import os
import requests
import json
from dotenv import load_dotenv

# Load API Key from .env file
load_dotenv()

class RecipeRecommender:
    def __init__(self, fallback_data_path):
        self.api_key = os.getenv('SPOONACULAR_API_KEY')
        self.base_url = "https://api.spoonacular.com/recipes"
        
        # Load local fallback data
        with open(fallback_data_path, 'r', encoding='utf-8') as f:
            self.local_recipes = json.load(f)

    def get_recommendations(self, ingredients, diet=None, cuisine=None, offset=0):
        """
        Main recommendation entry point. 
        Uses Spoonacular API if possible, otherwise falls back to local data.
        """
        if self.api_key:
            try:
                print(f"Fetching from Spoonacular API for: {ingredients} (Offset: {offset})")
                return self.fetch_from_api(ingredients, diet, cuisine, offset)
            except Exception as e:
                print(f"API Error: {e}. Falling back to local data.")
                return self.fetch_from_local(ingredients, diet, cuisine, offset)
        else:
            print("No API Key found. Using local data.")
            return self.fetch_from_local(ingredients, diet, cuisine, offset)

    def fetch_from_api(self, ingredients, diet=None, cuisine=None, offset=0):
        """Fetches recipes from Spoonacular findByIngredients endpoint."""
        params = {
            "apiKey": self.api_key,
            "ingredients": ",".join(ingredients),
            "number": 5,
            "offset": offset,
            "ranking": 1, 
            "ignorePantry": True
        }
        
        response = requests.get(f"{self.base_url}/findByIngredients", params=params)
        response.raise_for_status()
        api_results = response.json()

        recommendations = []
        for res in api_results:
            match_score = int((res['usedIngredientCount'] / (res['usedIngredientCount'] + res['missedIngredientCount'])) * 100) if (res['usedIngredientCount'] + res['missedIngredientCount']) > 0 else 0
            
            recommendations.append({
                "id": res['id'],
                "name": res['title'],
                "image": res['image'],
                "match_score": match_score,
                "matched_ingredients": [i['name'] for i in res['usedIngredients']],
                "missing_ingredients": [i['name'] for i in res['missedIngredients']],
                "cuisine": cuisine.capitalize() if cuisine and cuisine != 'any' else "Global",
                "diet": diet.capitalize() if diet and diet != 'any' else "Mixed",
                "region": "International",
                "explanation": f"Chef's Choice: Uses {res['usedIngredientCount']} of your ingredients!",
                "is_api": True
            })

        return recommendations

    def fetch_from_local(self, ingredients, diet=None, cuisine=None, offset=0):
        """Logic for local dataset with pagination support."""
        ingredients = [i.lower().strip() for i in ingredients]
        results = []
        for r in self.local_recipes:
            if diet and diet != 'any' and r['diet'].lower() != diet.lower(): continue
            if cuisine and cuisine != 'any' and r['cuisine'].lower() != cuisine.lower(): continue
            
            recipe_ings = [i.lower().strip() for i in r['ingredients']]
            matched = [i for i in recipe_ings if i in ingredients]
            score = int((len(matched) / len(recipe_ings)) * 100)
            
            results.append({
                "name": r['name'],
                "image": r.get('image'),
                "match_score": score,
                "matched_ingredients": matched,
                "missing_ingredients": [i for i in recipe_ings if i not in matched],
                "instructions": r['instructions'],
                "staples": r['staples'],
                "cuisine": r['cuisine'],
                "diet": r['diet'],
                "region": r['region'],
                "flag": r.get('flag', ''),
                "explanation": f"Found in our premium collection."
            })
        
        results.sort(key=lambda x: x['match_score'], reverse=True)
        return results[offset:offset+5]

    def get_instructions(self, recipe_id):
        """Fetches detailed instructions from Spoonacular."""
        params = {"apiKey": self.api_key}
        response = requests.get(f"{self.base_url}/{recipe_id}/information", params=params)
        response.raise_for_status()
        data = response.json()
        
        return {
            "instructions": data.get('instructions', "No instructions provided."),
            "staples": [i['name'] for i in data.get('extendedIngredients', []) if i.get('aisle') in ['Spices and Seasonings', 'Oil, Vinegar, Salad Dressing']],
            "summary": data.get('summary', '')
        }

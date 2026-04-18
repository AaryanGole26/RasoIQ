document.addEventListener('DOMContentLoaded', () => {
    const ingredientsInput = document.getElementById('ingredients');
    const dietSelect = document.getElementById('diet');
    const cuisineSelect = document.getElementById('cuisine');
    const recommendBtn = document.getElementById('recommend-btn');
    const resultsContainer = document.getElementById('results-container');
    const loader = document.getElementById('loader');
    const noResults = document.getElementById('no-results');
    
    // Pagination Elements
    const loadMoreBtn = document.getElementById('load-more-btn');
    const loadMoreContainer = document.getElementById('load-more-container');

    // Modal Elements
    const modal = document.getElementById('recipe-modal');
    const modalBody = document.getElementById('modal-body');
    const closeModal = document.getElementById('close-modal');

    // Update this URL after deploying the backend to Render
    const API_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' 
        ? 'http://127.0.0.1:5000' 
        : 'https://rasoiq.onrender.com'; 

    let currentOffset = 0;

    recommendBtn.addEventListener('click', () => {
        currentOffset = 0;
        fetchRecommendations(true);
    });

    loadMoreBtn.addEventListener('click', () => {
        currentOffset += 5;
        fetchRecommendations(false);
    });

    async function fetchRecommendations(isNewSearch) {
        const ingredients = ingredientsInput.value.split(',').map(i => i.trim()).filter(i => i !== "");
        
        if (ingredients.length === 0) {
            alert('Please enter at least one ingredient!');
            return;
        }

        // UI State: Loading
        if (isNewSearch) {
            resultsContainer.innerHTML = '';
            loader.classList.remove('hidden');
            noResults.classList.add('hidden');
            loadMoreContainer.classList.add('hidden');
        } else {
            loadMoreBtn.textContent = 'Loading...';
            loadMoreBtn.disabled = true;
        }

        try {
            const response = await fetch(`${API_URL}/recommend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ingredients: ingredients,
                    diet: dietSelect.value,
                    cuisine: cuisineSelect.value,
                    offset: currentOffset
                })
            });

            const data = await response.json();
            loader.classList.add('hidden');
            loadMoreBtn.textContent = 'Generate More';
            loadMoreBtn.disabled = false;

            if (data.status === 'success' && data.recipes.length > 0) {
                renderRecipes(data.recipes);
                if (data.recipes.length === 5) {
                    loadMoreContainer.classList.remove('hidden');
                } else {
                    loadMoreContainer.classList.add('hidden');
                }
            } else {
                if (isNewSearch) {
                    noResults.classList.remove('hidden');
                } else {
                    loadMoreContainer.classList.add('hidden');
                    alert('No more recipes found for these ingredients.');
                }
            }

        } catch (error) {
            console.error('Error fetching recommendations:', error);
            loader.classList.add('hidden');
            alert('Failed to connect to the backend server. Make sure the Python API is running!');
        }
    }

    function renderRecipes(recipes) {
        recipes.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'recipe-card';

            const matchedHtml = recipe.matched_ingredients.map(ing => `<span class="ing-item">${ing}</span>`);
            const missingHtml = recipe.missing_ingredients.map(ing => `<span class="ing-item missing">${ing}</span>`);
            const ingredientsHtml = [...matchedHtml, ...missingHtml].join(' ');

            // Use curated Unsplash links or API images
            const imageUrl = recipe.image || `https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&q=80&w=1000`;

            const sourceBadge = !recipe.is_api ? 
                `<span class="source-tag">🏠 Local Collection</span>` : 
                `<span class="source-tag api">✨ Chef Collection</span>`;

            card.innerHTML = `
                <img src="${imageUrl}" class="card-image" alt="${recipe.name}">
                <div class="recipe-content">
                    <div class="recipe-header">
                        <h3>${recipe.name}</h3>
                        <span class="match-badge">${recipe.match_score}% Match</span>
                    </div>
                    <div class="recipe-meta">
                        <span class="cuisine-tag">${recipe.cuisine}</span>
                        ${sourceBadge}
                    </div>
                    <div class="explanation">
                        <p style="font-size: 0.8rem; color: #fbbf24; margin-bottom: 1rem;">💡 ${recipe.explanation}</p>
                    </div>
                    <div class="ingredients-list">
                        <h4>Ingredients provided vs missing:</h4>
                        <div class="ing-badge-container">
                            ${ingredientsHtml}
                        </div>
                    </div>
                    <button class="view-steps-btn">View Cooking Steps</button>
                </div>
            `;

            const viewStepsBtn = card.querySelector('.view-steps-btn');
            viewStepsBtn.addEventListener('click', () => openRecipe(recipe));

            resultsContainer.appendChild(card);
        });
    }

    async function openRecipe(recipe) {
        if (recipe.is_api && !recipe.instructions) {
            modalBody.innerHTML = '<div class="loader"></div><p style="text-align:center">Fetching chef-secret instructions...</p>';
            modal.classList.remove('hidden');
            
            try {
                const res = await fetch(`${API_URL}/recipe/${recipe.id}/details`);
                const data = await res.json();
                if (data.status === 'success') {
                    recipe.instructions = data.details.instructions;
                    recipe.staples = data.details.staples;
                    recipe.summary = data.details.summary;
                    displayRecipeDetails(recipe);
                } else {
                    throw new Error("Failed to fetch details");
                }
            } catch (err) {
                modalBody.innerHTML = `<p style="color:red">Error: Could not load instructions. Reason: ${err.message}</p>`;
            }
        } else {
            displayRecipeDetails(recipe);
            modal.classList.remove('hidden');
        }
        document.body.style.overflow = 'hidden';
    }

    function displayRecipeDetails(recipe) {
        let stepsHtml = '';
        const rawInstructions = recipe.instructions || "No instructions provided.";

        if (rawInstructions.includes('<ol>') || rawInstructions.includes('<li>') || rawInstructions.includes('<ul>')) {
            stepsHtml = `<div class="step-item html-content">${rawInstructions}</div>`;
        } else {
            let rawSteps = rawInstructions.split(/\d+\.\s+/).filter(s => s.trim() !== "");
            if (rawSteps.length <= 1) {
                rawSteps = rawInstructions.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5);
            }
            stepsHtml = rawSteps.map((step, index) => `
                <div class="step-item">
                    <span class="step-num">Step ${index + 1}</span>
                    <p>${step.trim()}</p>
                </div>
            `).join('');
        }

        const cleanStaples = (recipe.staples || ['salt', 'oil', 'water']).map(s => 
            s.split('/')[0].split(',')[0].replace('m zarella', 'mozzarella').trim()
        );

        modalBody.innerHTML = `
            <div style="display:flex; gap:2rem; margin-bottom:2rem; align-items:center" class="modal-header-flex">
                <img src="${recipe.image || ''}" style="width:150px; height:150px; border-radius:15px; object-fit:cover" alt="${recipe.name}">
                <div>
                    <h2 style="font-size: 2.2rem; background: linear-gradient(to right, #ff6b6b, #4ecdc4); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; margin-bottom:0.5rem">
                        ${recipe.name}
                    </h2>
                    <p style="opacity:0.7">${recipe.cuisine}</p>
                </div>
            </div>
            <div class="step-list">
                ${stepsHtml}
            </div>
            <div class="staples-note">
                <p><strong>Chef's Note:</strong> This recipe assumes you have <strong>${cleanStaples.join(', ')}</strong> at home.</p>
            </div>
        `;
    }

    closeModal.addEventListener('click', () => {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    });
});

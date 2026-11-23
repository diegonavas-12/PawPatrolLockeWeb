import { OG_GYM_EXPORT_LEVELS, OG_GYM_ROUTES, OG_ROUTE_LOCATION_LABELS, getOgRouteSuggestions } from './locke-og.js';
import {
    V2_CAPTURE_AREAS,
    V2_LEGACY_GYM_ROUTE_KEYWORDS,
    getV2CaptureRouteSuggestions,
    getV2CaptureArea,
    canonicalizeV2PokemonRoute
} from './locke-v2.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getDatabase, ref, get, push, set, update, onValue, remove, runTransaction } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
// =========================================================================
// PEGA AQUÍ TU FIREBASE CONFIG
// =========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBdrTbVdGadlk2ICtbkUzQ9MtmCZogFK30",
    authDomain: "randomlocke-c681d.firebaseapp.com",
    databaseURL: "https://randomlocke-c681d-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "randomlocke-c681d",
    storageBucket: "randomlocke-c681d.firebasestorage.app",
    messagingSenderId: "719151682829",
    appId: "1:719151682829:web:cbd5c278fc594c21de4c44",
    measurementId: "G-VETD12P19S"
};
// =========================================================================

let db;
let auth;
let currentPlayer = null;
let currentLocke = 'PawPatrolV2';
let currentAccountEmail = '';
let stopUserDataListener = null;
let stopSuggestionsListener = null;
let handlingAuthAction = false;
let globalData = []; let globalBadges = {}; let rankingData = {}; let globalRepelentes = [];
let globalEco = {}; let globalInv = {}; let globalActivos = {}; let globalFailedRoutes = {}; let globalEquiposGimnasio = {};
let currentScreen = 'landing';
let selectedBanPlayer = '';
let kalosMapInstance = null;
let kalosMapMarkers = null;
let kalosMapBaseZoom = null;
let kalosMapLocke = null;

// Variable temporal para el teambuilder de gimnasio - ahora independiente por gimnasio
let gymTeamSelection = {}; // Objeto con selecciones por gimnasio: { '1': [], '2': [], ... }
let gymTeamSelectionLoaded = {}; // Para controlar si ya se cargó el equipo de cada gimnasio
let teamAutocompleteRequestId = 0;

const PLAYERS_IN_BOTH_LOCKES = ["Navas", "Varo", "Camilo", "Sergio", "Rubén", "Samu"];
const LOCKE_PLAYERS = {
    PawPatrolOG: [...PLAYERS_IN_BOTH_LOCKES, "David"],
    PawPatrolV2: [...PLAYERS_IN_BOTH_LOCKES, "Víctor", "Mario"]
};
const PLAYERS = [...new Set(Object.values(LOCKE_PLAYERS).flat())];
function getPlayerLockes(player) {
    return Object.keys(LOCKE_PLAYERS).filter(locke => LOCKE_PLAYERS[locke].includes(player));
}
['register-player', 'link-player'].forEach(selectId => {
    const select = document.getElementById(selectId);
    PLAYERS.forEach(player => select.add(new Option(player, player)));
});

// --- 1. NUEVAS SKINS AMPLIADAS (110 ENTRENADORES) ---
const G_SKINS = [
    'red', 'leaf', 'ethan', 'lyra', 'brendan', 'may', 'lucas', 'dawn', 'hilbert', 'hilda', 'nate', 'rosa', 'calem', 'serena',
    'cynthia', 'steven', 'wallace', 'lance', 'alder', 'iris', 'diantha',
    'blue', 'brock', 'misty', 'lt_surge', 'erika', 'koga', 'sabrina', 'blaine', 'giovanni',
    'falkner', 'bugsy', 'whitney', 'morty', 'chuck', 'jasmine', 'pryce', 'clair',
    'roxanne', 'brawly', 'wattson', 'flannery', 'norman', 'winona', 'tate', 'liza', 'juan',
    'roark', 'gardenia', 'maylene', 'crasherwake', 'fantina', 'byron', 'candice', 'volkner',
    'cilan', 'chili', 'cress', 'lenora', 'burgh', 'elesa', 'clay', 'skyla', 'brycen', 'drayden', 'cheren', 'roxie', 'marlon', 'hugh',
    'lorelei', 'bruno', 'agatha', 'will', 'karen', 'sidney', 'phoebe', 'glacia', 'drake', 'aaron', 'bertha', 'flint', 'lucian', 'shauntal', 'marshal', 'grimsley', 'caitlin',
    'n', 'ghetsis', 'colress', 'maxie', 'archie', 'cyrus', 'lusamine', 'guzma',
    'youngster', 'lass', 'hiker', 'picnicker', 'camper', 'birdkeeper', 'swimmer', 'swimmerf', 'blackbelt', 'beauty', 'sailor', 'scientist', 'supernerd', 'biker', 'tamer', 'juggler', 'pokemaniac', 'gentleman', 'ruinmaniac', 'hexmaniac', 'ace-trainer', 'ace-trainerf', 'veteran', 'veteranf', 'ninja-boy', 'parasol-lady', 'waiter', 'waitress', 'clown', 'artist', 'dancer'
];

const G_SKIN_SPRITE_ALIASES = {
    'leaf': 'leaf-gen3', 'lt_surge': 'ltsurge', 'lorelei': 'lorelei-lgpe',
    'agatha': 'agatha-gen3', 'phoebe': 'phoebe-gen6', 'drake': 'drake-gen3',
    'maxie': 'maxie-gen6', 'archie': 'archie-gen6', 'tamer': 'tamer-gen3',
    'hexmaniac': 'hexmaniac-gen6', 'ace-trainer': 'acetrainer', 'ace-trainerf': 'acetrainerf',
    'ninja-boy': 'ninjaboy', 'parasol-lady': 'parasollady'
};

function getSkinSpriteId(skinId) {
    const normalizedId = (skinId || '').trim().toLowerCase();
    return G_SKIN_SPRITE_ALIASES[normalizedId] || normalizedId;
}

function compactSpeciesName(name) {
    return (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/♀/g, 'f').replace(/♂/g, 'm').replace(/[^a-z0-9]/g, '');
}

function getPokemonSpriteId(name) {
    return compactSpeciesName(name);
}

function getPokemonSpriteUrl(pokemon, isDead = false) {
    const spriteId = getPokemonSpriteId(pokemon.especie);
    if(isDead) return `https://play.pokemonshowdown.com/sprites/${pokemon.shiny ? 'gen5-shiny' : 'gen5'}/${spriteId}.png`;
    return `https://play.pokemonshowdown.com/sprites/${pokemon.shiny ? 'ani-shiny' : 'ani'}/${spriteId}.gif`;
}

const POKEMON_TYPE_COLORS = {
    normal: '#a8a77a', fire: '#ee8130', water: '#6390f0', electric: '#f7d02c',
    grass: '#7ac74c', ice: '#96d9d6', fighting: '#c22e28', poison: '#a33ea1',
    ground: '#e2bf65', flying: '#a98ff3', psychic: '#f95587', bug: '#a6b91a',
    rock: '#b6a136', ghost: '#735797', dragon: '#6f35fc', dark: '#705746',
    steel: '#b7b7ce', fairy: '#d685ad'
};
const POKEMON_TYPE_NAMES = {
    normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico',
    grass: 'Planta', ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno',
    ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
    rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro',
    steel: 'Acero', fairy: 'Hada'
};
const POKEMON_TYPE_CHART = {
    normal: { resist: ['rock', 'steel'], immune: ['ghost'] },
    fire: { weak: ['grass', 'ice', 'bug', 'steel'], resist: ['fire', 'water', 'rock', 'dragon'] },
    water: { weak: ['fire', 'ground', 'rock'], resist: ['water', 'grass', 'dragon'] },
    electric: { weak: ['water', 'flying'], resist: ['electric', 'grass', 'dragon'], immune: ['ground'] },
    grass: { weak: ['water', 'ground', 'rock'], resist: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'] },
    ice: { weak: ['grass', 'ground', 'flying', 'dragon'], resist: ['fire', 'water', 'ice', 'steel'] },
    fighting: { weak: ['normal', 'ice', 'rock', 'dark', 'steel'], resist: ['poison', 'flying', 'psychic', 'bug', 'fairy'], immune: ['ghost'] },
    poison: { weak: ['grass', 'fairy'], resist: ['poison', 'ground', 'rock', 'ghost'], immune: ['steel'] },
    ground: { weak: ['fire', 'electric', 'poison', 'rock', 'steel'], resist: ['grass', 'bug'], immune: ['flying'] },
    flying: { weak: ['grass', 'fighting', 'bug'], resist: ['electric', 'rock', 'steel'] },
    psychic: { weak: ['fighting', 'poison'], resist: ['psychic', 'steel'], immune: ['dark'] },
    bug: { weak: ['grass', 'psychic', 'dark'], resist: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'] },
    rock: { weak: ['fire', 'ice', 'flying', 'bug'], resist: ['fighting', 'ground', 'steel'] },
    ghost: { weak: ['psychic', 'ghost'], resist: ['dark'], immune: ['normal'] },
    dragon: { weak: ['dragon'], resist: ['steel'], immune: ['fairy'] },
    dark: { weak: ['psychic', 'ghost'], resist: ['fighting', 'dark', 'fairy'] },
    steel: { weak: ['ice', 'rock', 'fairy'], resist: ['fire', 'water', 'electric', 'steel'] },
    fairy: { weak: ['fighting', 'dragon', 'dark'], resist: ['fire', 'poison', 'steel'] }
};
const pokemonTypeDataCache = new Map();
let teamWeaknessRequestId = 0;
let deathAnimationTimeout = null;
let deathAnimationPokemonId = null;

function getPokemonTypeData(speciesName) {
    const speciesSlug = slugifySpeciesName(speciesName);
    if(!pokemonTypeDataCache.has(speciesSlug)) {
        const request = fetch(`https://pokeapi.co/api/v2/pokemon/${speciesSlug}`)
            .then(response => {
                if(!response.ok) throw new Error(`PokéAPI respondió ${response.status} para ${speciesName}.`);
                return response.json();
            })
            .then(data => data.types.sort((a, b) => a.slot - b.slot).map(entry => entry.type.name))
            .catch(error => {
                pokemonTypeDataCache.delete(speciesSlug);
                throw error;
            });
        pokemonTypeDataCache.set(speciesSlug, request);
    }
    return pokemonTypeDataCache.get(speciesSlug);
}

function getTypeEffectivenessMultiplier(attackType, defendingTypes) {
    return defendingTypes.reduce((multiplier, defendingType) => {
        const rules = POKEMON_TYPE_CHART[attackType] || {};
        if(rules.immune?.includes(defendingType)) return 0;
        if(rules.weak?.includes(defendingType)) return multiplier * 2;
        if(rules.resist?.includes(defendingType)) return multiplier * 0.5;
        return multiplier;
    }, 1);
}

function scoreTeamByTypes(team) {
    const teamTypes = new Set();
    const offensiveCoverage = new Set();
    team.forEach(({ types }) => types.forEach(type => {
        teamTypes.add(type);
        (POKEMON_TYPE_CHART[type]?.weak || []).forEach(coveredType => offensiveCoverage.add(coveredType));
    }));

    let weaknessExposure = 0;
    let coveredWeaknessTypes = 0;
    let uncoveredWeaknessTypes = 0;
    Object.keys(POKEMON_TYPE_CHART).forEach(attackType => {
        const multipliers = team.map(({ types }) => getTypeEffectivenessMultiplier(attackType, types));
        const weaknesses = multipliers.filter(multiplier => multiplier >= 2);
        if(!weaknesses.length) return;

        weaknessExposure += weaknesses.reduce((total, multiplier) => total + Math.log2(multiplier), 0);
        if(multipliers.some(multiplier => multiplier < 1)) coveredWeaknessTypes++;
        else uncoveredWeaknessTypes++;
    });

    return teamTypes.size * 2 + offensiveCoverage.size * 3 +
        coveredWeaknessTypes * 2 - weaknessExposure * 2 - uncoveredWeaknessTypes * 4;
}

function recommendTeamByTypes(candidates, teamLimit = 6, fixedTeam = []) {
    const orderedCandidates = candidates.filter(candidate =>
        !fixedTeam.some(member => member.id === candidate.id)
    );
    const remaining = [...orderedCandidates];
    const team = [...fixedTeam];

    while(team.length < teamLimit && remaining.length) {
        let bestIndex = 0;
        let bestScore = -Infinity;
        remaining.forEach((candidate, index) => {
            const score = scoreTeamByTypes([...team, candidate]);
            if(score > bestScore) {
                bestIndex = index;
                bestScore = score;
            }
        });
        team.push(remaining.splice(bestIndex, 1)[0]);
    }

    for(let teamIndex = fixedTeam.length; teamIndex < team.length; teamIndex++) {
        let bestReplacement = null;
        let bestScore = scoreTeamByTypes(team);
        orderedCandidates.forEach(candidate => {
            if(team.some(member => member.id === candidate.id)) return;
            const proposal = [...team];
            proposal[teamIndex] = candidate;
            const score = scoreTeamByTypes(proposal);
            if(score > bestScore) {
                bestReplacement = candidate;
                bestScore = score;
            }
        });
        if(bestReplacement) team[teamIndex] = bestReplacement;
    }

    return team;
}

function applyPokemonTypeStyles(container) {
    const cardsBySpecies = new Map();
    container.querySelectorAll('.poke-card[data-species]').forEach(card => {
        const species = card.dataset.species;
        if(!cardsBySpecies.has(species)) cardsBySpecies.set(species, []);
        cardsBySpecies.get(species).push(card);
    });
    cardsBySpecies.forEach((cards, species) => {
        getPokemonTypeData(species).then(types => {
            const primaryType = types[0];
            const color = POKEMON_TYPE_COLORS[primaryType];
            if(!color) return;
            cards.forEach(card => {
                card.dataset.primaryType = primaryType;
                card.style.borderColor = color;
                card.style.boxShadow = card.classList.contains('in-team-bg')
                    ? `0 0 15px ${color}88, 0 0 0 3px #3b82f6`
                    : `0 0 15px ${color}66`;
            });
        }).catch(error => console.warn(`No se pudo cargar el tipo de ${species}:`, error));
    });
}

function pokemonSpriteFallback(image) {
    image.onerror = null;
    const pokemon = { especie: image.dataset.speciesName, shiny: image.dataset.shiny === 'true' };
    image.src = getPokemonSpriteUrl(pokemon, true);
    image.onerror = () => {
        image.onerror = null;
        image.src = 'https://play.pokemonshowdown.com/sprites/itemicons/pokeball.png';
    };
}
window.pokemonSpriteFallback = pokemonSpriteFallback;

function slugifySpeciesName(name) {
    return (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/♀/g, '-f').replace(/♂/g, '-m').replace(/['’.]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

let speciesIndexPromise = null;
function loadSpeciesIndex() {
    if (!speciesIndexPromise) {
        speciesIndexPromise = fetch('https://pokeapi.co/api/v2/pokemon-species?limit=2000')
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => {
                const index = {};
                data.results.forEach(r => { index[compactSpeciesName(r.name)] = r.name; });
                return index;
            })
            .catch(err => { speciesIndexPromise = null; throw err; });
    }
    return speciesIndexPromise;
}

async function resolveSpeciesSlug(name) {
    try {
        const index = await loadSpeciesIndex();
        const slug = index[compactSpeciesName(name)];
        if (slug) return slug;
    } catch (e) {}
    return slugifySpeciesName(name);
}

function formatSpeciesName(name) {
    return (name || '').trim().split(/([\s-]+)/).map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('');
}

function getSpeciesEnglishName(speciesData) {
    const en = speciesData && speciesData.names && speciesData.names.find(n => n.language && n.language.name === 'en');
    return en ? en.name.replace(/’/g, "'") : formatSpeciesName(speciesData.name.replace(/-/g, ' '));
}

async function getSpeciesDisplayName(slug) {
    try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${slug}`);
        if (res.ok) return getSpeciesEnglishName(await res.json());
    } catch (e) {}
    return formatSpeciesName(slug.replace(/-/g, ' '));
}

const G_BANNERS = [
    'bg-gradient-to-r from-red-500 to-orange-500',
    'bg-gradient-to-r from-blue-500 to-cyan-500',
    'bg-gradient-to-r from-green-500 to-lime-500',
    'bg-gradient-to-r from-purple-500 to-pink-500',
    'bg-gradient-to-r from-yellow-400 to-yellow-600',
    'bg-gradient-to-r from-gray-800 to-gray-600',
    'bg-gradient-to-r from-emerald-500 to-teal-600',
    'bg-gradient-to-r from-cyan-500 to-blue-700',
    'bg-gradient-to-r from-sky-500 to-indigo-600',
    'bg-gradient-to-r from-violet-600 to-fuchsia-500',
    'bg-gradient-to-r from-pink-600 to-purple-700',
    'bg-gradient-to-r from-rose-600 to-red-700',
    'bg-gradient-to-r from-orange-600 to-amber-500',
    'bg-gradient-to-r from-amber-500 to-lime-600',
    'bg-gradient-to-r from-lime-500 to-emerald-700',
    'bg-gradient-to-r from-teal-500 to-cyan-700',
    'bg-gradient-to-r from-indigo-700 to-blue-500',
    'bg-gradient-to-r from-blue-800 to-purple-600',
    'bg-gradient-to-r from-fuchsia-700 to-pink-500',
    'bg-gradient-to-r from-red-700 to-yellow-500',
    'bg-gradient-to-r from-yellow-500 to-orange-600',
    'bg-gradient-to-r from-slate-800 to-slate-600',
    'bg-gradient-to-r from-gray-900 to-blue-800',
    'bg-gradient-to-r from-zinc-800 to-stone-600'
];
const G_BANNER_NAMES = [
    'Rojo difuminado',
    'Azul eléctrico',
    'Verde lima',
    'Morado rosado',
    'Amarillo dorado',
    'Gris humo',
    'Verde esmeralda',
    'Azul cian',
    'Celeste índigo',
    'Violeta fucsia',
    'Rosa morado',
    'Rojo carmesí',
    'Naranja ámbar',
    'Ámbar lima',
    'Lima esmeralda',
    'Turquesa',
    'Azul índigo',
    'Azul violeta',
    'Fucsia rosa',
    'Rojo dorado',
    'Amarillo anaranjado',
    'Gris pizarra',
    'Azul noche',
    'Gris piedra'
];
function getBannerName(banner) {
    const index = G_BANNERS.indexOf(banner);
    return index < 0 ? 'Banner clásico' : G_BANNER_NAMES[index];
}
const G_CONSUMABLES = {
    'revivir': { name: 'Revivir Máximo (Revive a un muerto)', icon: 'max-revive' },
    'ban': { name: 'Tarjeta Roja (Banear rival)', icon: 'eject-button' },
    'skip': { name: 'Repelente Máximo (registrar encuentro)', icon: 'max-repel' }
};

const GYM_BADGES = [
    { id: 'b1', name: 'Medalla Base', icon: '🏢', maxLevel: 13 }, { id: 'b2', name: 'Medalla Ponzoña', icon: '☠️', maxLevel: 18 },
    { id: 'b3', name: 'Medalla Élitro', icon: '🐛', maxLevel: 24 }, { id: 'b4', name: 'Medalla Voltio', icon: '⚡', maxLevel: 30 },
    { id: 'b5', name: 'Medalla Temblor', icon: '🪨', maxLevel: 33 }, { id: 'b6', name: 'Medalla Jet', icon: '✈️', maxLevel: 39 },
    { id: 'b7', name: 'Medalla Leyenda', icon: '🐉', maxLevel: 43 }, { id: 'b8', name: 'Medalla Ola', icon: '🌊', maxLevel: 51 },
    { id: 'b9', name: 'Liga Pokémon', icon: '🏆', maxLevel: 59 }
];
function syncOgRouteAutocomplete() {
    const isOg = currentLocke === 'PawPatrolOG';
    const isV2 = currentLocke === 'PawPatrolV2';
    const datalist = document.getElementById('og-route-options');
    const suggestions = isOg ? getOgRouteSuggestions()
        : isV2 ? getV2CaptureRouteSuggestions() : [];
    datalist.replaceChildren(...(isOg || isV2
        ? suggestions.map(route => {
            const option = document.createElement('option');
            option.value = route;
            return option;
        })
        : []));
    const ogRouteInputIds = ['routeInput', 'failedRouteInput', 'edit-route'];
    const routeInputIds = [...ogRouteInputIds, 'repel-route', 'edit-capture-route'];
    routeInputIds.forEach(inputId => {
        const input = document.getElementById(inputId);
        if(!input) return;
        if(isV2 || (isOg && ogRouteInputIds.includes(inputId))) {
            input.setAttribute('list', 'og-route-options');
            setupOgRouteAutocomplete(input, suggestions);
        } else {
            input.removeAttribute('list');
            setupOgRouteAutocomplete(input, []);
        }
    });
    document.getElementById('og-route-hint-add').innerText = isOg
        ? 'Selecciona una ruta o zona de la lista para registrar la captura.'
        : 'Elige una ubicación y zona de captura para identificarla en el mapa y validar el equipo.';
    document.getElementById('og-route-hint-edit').innerText = isOg
        ? 'Selecciona una ruta o zona de la lista para guardar el cambio.'
        : 'Elige una ubicación y zona de captura para identificarla en el mapa y validar el equipo.';
    document.getElementById('og-route-hint-add').classList.toggle('hidden', !(isOg || isV2));
    document.getElementById('og-route-hint-edit').classList.toggle('hidden', !(isOg || isV2));
}

function setupOgRouteAutocomplete(input, suggestions) {
    if(!input) return;
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if(isIOS) input.removeAttribute('list');
    if(input.parentElement) input.parentElement.style.position = 'relative';

    let dropdown = input.parentElement.querySelector(':scope > .og-route-suggestions');
    if(!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = 'og-route-suggestions hidden';
        dropdown.setAttribute('role', 'listbox');
        input.parentElement.appendChild(dropdown);
    }

    input.oninput = () => renderOgRouteSuggestions(input, dropdown, suggestions);
    input.onfocus = () => renderOgRouteSuggestions(input, dropdown, suggestions);
    input.onkeydown = event => handleOgRouteAutocompleteKeydown(input, dropdown, event);
    input.onblur = () => window.setTimeout(() => dropdown.classList.add('hidden'), 150);
}

function renderOgRouteSuggestions(input, dropdown, suggestions) {
    const query = normalizeRouteKeyword(input.value);
    const matches = suggestions.filter(route => {
        return !query || normalizeRouteKeyword(route).includes(query);
    }).slice(0, 12);
    dropdown.replaceChildren();
    if(!matches.length) {
        dropdown.classList.add('hidden');
        return;
    }
    matches.forEach((route, index) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = `og-route-suggestion${index === 0 ? ' is-active' : ''}`;
        option.textContent = route;
        option.setAttribute('role', 'option');
        option.onmousedown = event => event.preventDefault();
        option.onclick = () => {
            input.value = route;
            dropdown.classList.add('hidden');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        };
        dropdown.appendChild(option);
    });
    dropdown.classList.remove('hidden');
}

function handleOgRouteAutocompleteKeydown(input, dropdown, event) {
    const options = [...dropdown.querySelectorAll('.og-route-suggestion')];
    if(!options.length) return;
    let activeIndex = options.findIndex(option => option.classList.contains('is-active'));
    if(event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        activeIndex = event.key === 'ArrowDown'
            ? (activeIndex + 1) % options.length
            : (activeIndex - 1 + options.length) % options.length;
        options.forEach((option, index) => option.classList.toggle('is-active', index === activeIndex));
        options[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if(event.key === 'Enter' && !dropdown.classList.contains('hidden') && activeIndex >= 0) {
        event.preventDefault();
        options[activeIndex].click();
    } else if(event.key === 'Escape') {
        dropdown.classList.add('hidden');
    }
}

function getCanonicalRouteEntry(route) {
    const suggestions = currentLocke === 'PawPatrolOG' ? getOgRouteSuggestions()
        : currentLocke === 'PawPatrolV2' ? getV2CaptureRouteSuggestions()
        : null;
    if(!suggestions) return route.trim();
    return suggestions.find(suggestion =>
        normalizeRouteKeyword(suggestion) === normalizeRouteKeyword(route)
    ) || (currentLocke === 'PawPatrolV2' ? '' : route.trim());
}

function isValidRouteEntry(route) {
    if(currentLocke === 'PawPatrolOG') {
        return getOgRouteSuggestions().some(suggestion =>
            normalizeRouteKeyword(suggestion) === normalizeRouteKeyword(route)
        );
    }
    if(currentLocke === 'PawPatrolV2') {
        return getV2CaptureRouteSuggestions().some(suggestion =>
            normalizeRouteKeyword(suggestion) === normalizeRouteKeyword(route)
        );
    }
    return true;
}

function normalizeRouteKeyword(value) {
    return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

const KALOS_MAP_SIZE = { width: 1171, height: 768 };
const KALOS_MAP_BOUNDS = [[0, 0], [KALOS_MAP_SIZE.height, KALOS_MAP_SIZE.width]];

function mapKalosPercent(x, y) {
    // Leaflet's Simple CRS counts latitude bottom-to-top; map coordinates count y top-to-bottom.
    return [
        (100 - y) * KALOS_MAP_SIZE.height / 100,
        x * KALOS_MAP_SIZE.width / 100
    ];
}

const KALOS_CAPTURE_LOCATIONS = [
    { name: 'Inicial · Pueblo Boceto', coords: mapKalosPercent(66.8, 81.8), aliases: ['inicial', 'pueblo boceto', 'inicial de pueblo boceto'] },
    { name: 'Ruta 2', coords: mapKalosPercent(66.2, 66.5), aliases: ['ruta 2'] },
    { name: 'Bosque Novarte', coords: mapKalosPercent(65.5, 62.0), aliases: ['bosque novarte'] },
    { name: 'Ruta 3', coords: mapKalosPercent(64.5, 57.5), aliases: ['ruta 3'] },
    { name: 'Ruta 22', coords: mapKalosPercent(69.5, 51.1), aliases: ['ruta 22'] },
    { name: 'Ruta 4', coords: mapKalosPercent(59.0, 44.5), aliases: ['ruta 4'] },
    { name: 'Ciudad Luminalia · Laboratorio', coords: mapKalosPercent(53.9, 35.1), aliases: ['ciudad luminalia', 'laboratorio'] },
    { name: 'Ruta 5', coords: mapKalosPercent(48.6, 45.0), aliases: ['ruta 5'] },
    { name: 'Ruta 6', coords: mapKalosPercent(38.2, 50.5), aliases: ['ruta 6'] },
    { name: 'Palacio Cenit', coords: mapKalosPercent(32.9, 46.2), aliases: ['palacio cenit'] },
    { name: 'Ruta 7', coords: mapKalosPercent(31.8, 60.0), aliases: ['ruta 7'] },
    { name: 'Gruta Tierraunida', coords: mapKalosPercent(26.0, 62.5), aliases: ['gruta tierraunida'] },
    { name: 'Ruta 8', coords: mapKalosPercent(22.5, 63.5), aliases: ['ruta 8'] },
    { name: 'Pueblo Vánitas', coords: mapKalosPercent(43.3, 54.8), aliases: ['pueblo vanitas'] },
    { name: 'Pueblo Petroglifo', coords: mapKalosPercent(24.6, 71.1), aliases: ['pueblo petroglifo', 'pueblo vanitas revivir fosiles'] },
    { name: 'Ruta 9', coords: mapKalosPercent(32.5, 71.1), aliases: ['ruta 9'] },
    { name: 'Cueva Brillante', coords: mapKalosPercent(40.5, 71.1), aliases: ['cueva brillante'] },
    { name: 'Ciudad Relieve', coords: mapKalosPercent(20.3, 55.6), aliases: ['ciudad relieve'] },
    { name: 'Ruta 10', coords: mapKalosPercent(15.0, 51.8), aliases: ['ruta 10'] },
    { name: 'Cueva Reflejos', coords: mapKalosPercent(14.0, 45.0), aliases: ['cueva de los reflejos', 'cueva reflejos'] },
    { name: 'Ruta 11', coords: mapKalosPercent(11.7, 45.5), aliases: ['ruta 11'] },
    { name: 'Ciudad Yantra · Torre Maestría', coords: mapKalosPercent(16.6, 33.7), aliases: ['ciudad yantra', 'torre maestria', 'lucario'] },
    { name: 'Ruta 12', coords: mapKalosPercent(22.0, 31.6), aliases: ['ruta 12'] },
    { name: 'Bahía Azul', coords: mapKalosPercent(35.8, 20.3), aliases: ['bahia azul'] },
    { name: 'Ruta 13', coords: mapKalosPercent(43.1, 34.0), aliases: ['ruta 13'] },
    { name: 'Ruta 14', coords: mapKalosPercent(49.3, 20.3), aliases: ['ruta 14'] },
    { name: 'Ruta 15', coords: mapKalosPercent(63.0, 14.0), aliases: ['ruta 15'] },
    { name: 'Hotel Desolación', coords: mapKalosPercent(70.3, 26.2), aliases: ['hotel desolacion'] },
    { name: 'Ruta 16', coords: mapKalosPercent(62.2, 30.6), aliases: ['ruta 16'] },
    { name: 'Gruta Helada', coords: mapKalosPercent(77.3, 17.5), aliases: ['caverna helada', 'gruta helada'] },
    { name: 'Ruta 17', coords: mapKalosPercent(79.1, 32.4), aliases: ['ruta 17'] },
    { name: 'Ruta 18', coords: mapKalosPercent(90.9, 42.6), aliases: ['ruta 18'] },
    { name: 'Cueva Desenlace', coords: mapKalosPercent(94.0, 30.3), aliases: ['cueva terminus', 'cueva desenlace'] },
    { name: 'Ruta 19', coords: mapKalosPercent(89.5, 50.2), aliases: ['ruta 19'] },
    { name: 'Ruta 20', coords: mapKalosPercent(83.8, 62.0), aliases: ['ruta 20'] },
    { name: 'Villa Pokémon', coords: mapKalosPercent(82.4, 70.3), aliases: ['villa pokemon'] },
    { name: 'Ruta 21', coords: mapKalosPercent(80.3, 51.4), aliases: ['ruta 21'] },
    { name: 'Calle Victoria', coords: mapKalosPercent(75.6, 49.0), aliases: ['calle victoria'] }
];
const KALOS_GYM_LOCATIONS = [
    { number: '1', city: 'Ciudad Novarte', coords: mapKalosPercent(63.4, 53.2) },
    { number: '2', city: 'Ciudad Relieve', coords: mapKalosPercent(20.3, 55.6) },
    { number: '3', city: 'Ciudad Yantra', coords: mapKalosPercent(16.6, 33.7) },
    { number: '4', city: 'Ciudad Témpera', coords: mapKalosPercent(36.0, 26.6) },
    { number: '5', city: 'Ciudad Luminalia', coords: mapKalosPercent(53.9, 35.1) },
    { number: '6', city: 'Ciudad Romantis', coords: mapKalosPercent(53.9, 12.8) },
    { number: '7', city: 'Ciudad Fluxus', coords: mapKalosPercent(87.8, 38.6) },
    { number: '8', city: 'Ciudad Fractal', coords: mapKalosPercent(85.1, 53.8) }
];

const V2_MAP_SIZE = { width: 2532, height: 1664 };
const V2_MAP_BOUNDS = [[0, 0], [V2_MAP_SIZE.height, V2_MAP_SIZE.width]];
const V2_MAP_LOCATIONS = [
    { id: 'ciudad_engobe', name: 'Ciudad Engobe', type: 'ciudad', x: 5.2, y: 91.5, postgame: false, connections: ['ruta_19', 'engobe_agua_surf'] },
    { id: 'engobe_agua_surf', name: 'Ciudad Engobe - Agua (Surf)', type: 'zona', x: 2.8, y: 93.6, postgame: false, markerLabel: 'ES', connections: ['ciudad_engobe'] },
    { id: 'ruta_19', name: 'Ruta 19', type: 'ruta', x: 7.5, y: 77.5, postgame: false, connections: ['ciudad_engobe', 'pueblo_ocre'] },
    { id: 'pueblo_ocre', name: 'Pueblo Ocre', type: 'pueblo', x: 12.6, y: 75.5, postgame: false, connections: ['ruta_19', 'ruta_20', 'rancho_ocre', 'arboleda_promesa'] },
    { id: 'rancho_ocre', name: 'Rancho Ocre', type: 'zona', x: 15.8, y: 70.0, postgame: false, connections: ['pueblo_ocre', 'claro_oculto_rancho_ocre'] },
    { id: 'claro_oculto_rancho_ocre', name: 'Claro Oculto - Rancho Ocre', type: 'zona', x: 18.0, y: 67.2, postgame: false, markerLabel: 'CR', connections: ['rancho_ocre'] },
    { id: 'arboleda_promesa', name: 'Arboleda Promesa', type: 'zona', x: 15.8, y: 82.2, postgame: false, connections: ['pueblo_ocre'] },
    { id: 'ruta_20', name: 'Ruta 20', type: 'ruta', x: 19.8, y: 75.5, postgame: false, connections: ['pueblo_ocre', 'ciudad_hormigon'] },
    { id: 'ciudad_hormigon', name: 'Ciudad Hormigón', type: 'ciudad', x: 26.8, y: 75.5, postgame: false, connections: ['ruta_20', 'pokewood', 'poligono_hormigon', 'ciudad_porcelana'] },
    { id: 'pokewood', name: 'Pokéwood', type: 'zona', x: 24.8, y: 68.4, postgame: false, connections: ['ciudad_hormigon'] },
    { id: 'poligono_hormigon', name: 'Polígono Hormigón', type: 'zona', x: 24.8, y: 82.2, postgame: false, connections: ['ciudad_hormigon'] },
    { id: 'torre_union', name: 'Torre Unión', type: 'zona', x: 28.6, y: 86.7, postgame: false, connections: ['ciudad_porcelana'] },
    { id: 'isla_libertad', name: 'Isla Libertad', type: 'zona', x: 38.6, y: 94.0, postgame: false, connections: ['ciudad_porcelana'] },
    { id: 'ciudad_porcelana', name: 'Ciudad Porcelana', type: 'ciudad', x: 51.5, y: 77.5, postgame: false, connections: ['ciudad_hormigon', 'cloacas_porcelana', 'gruta_antigua', 'parque_porcelana', 'ruta_4', 'puente_saeta'] },
    { id: 'cloacas_porcelana', name: 'Cloacas Porcelana', type: 'zona', x: 60.8, y: 85.0, postgame: false, connections: ['ciudad_porcelana', 'gruta_antigua'] },
    { id: 'gruta_antigua', name: 'Pasadizo Ancestral', type: 'zona', x: 40.9, y: 70.0, postgame: false, connections: ['ciudad_porcelana', 'cloacas_porcelana', 'pwt'] },
    { id: 'parque_porcelana', name: 'Parque Porcelana', type: 'zona', x: 54.2, y: 81.0, postgame: false, markerLabel: 'PP', connections: ['ciudad_porcelana'] },
    { id: 'ruta_4', name: 'Ruta 4', type: 'ruta', x: 51.5, y: 69.5, postgame: false, connections: ['ciudad_porcelana', 'galeria_union'] },
    { id: 'galeria_union', name: 'Galería Unión', type: 'zona', x: 51.5, y: 62.0, postgame: false, connections: ['ruta_4', 'zona_desierto', 'ciudad_mayolica'] },
    { id: 'zona_desierto', name: 'Zona Desierto', type: 'zona', x: 48.0, y: 62.0, postgame: false, connections: ['galeria_union', 'castillo_ancestral'] },
    { id: 'castillo_ancestral', name: 'Castillo Ancestral', type: 'zona', x: 44.8, y: 62.0, postgame: false, connections: ['zona_desierto'] },
    { id: 'ciudad_mayolica', name: 'Ciudad Mayólica', type: 'ciudad', x: 51.5, y: 54.5, postgame: false, connections: ['galeria_union', 'ruta_5', 'ruta_16', 'pueblo_biscuit'] },
    { id: 'zona_nexo', name: 'Zona Nexo', type: 'zona', x: 51.5, y: 40.0, postgame: false, connections: [] },
    { id: 'ruta_16', name: 'Ruta 16', type: 'ruta', x: 57.0, y: 54.5, postgame: false, connections: ['ciudad_mayolica', 'bosque_perdido', 'puente_progreso'] },
    { id: 'bosque_perdido', name: 'Bosque Perdidos', type: 'zona', x: 56.8, y: 50.0, postgame: false, connections: ['ruta_16', 'claro_oculto_bosque_perdidos'] },
    { id: 'claro_oculto_bosque_perdidos', name: 'Claro Oculto - Bosque Perdidos', type: 'zona', x: 54.8, y: 48.5, postgame: false, markerLabel: 'CB', connections: ['bosque_perdido'] },
    { id: 'ruta_5', name: 'Ruta 5', type: 'ruta', x: 45.0, y: 54.5, postgame: false, connections: ['ciudad_mayolica', 'puente_fayenza', 'claro_oculto_ruta_5'] },
    { id: 'claro_oculto_ruta_5', name: 'Claro Oculto - Ruta 5', type: 'zona', x: 42.8, y: 52.8, postgame: false, markerLabel: 'C5', connections: ['ruta_5'] },
    { id: 'puente_fayenza', name: 'Puente de Fayenza', type: 'puente', x: 37.5, y: 54.5, postgame: false, connections: ['ruta_5', 'ciudad_fayenza'] },
    { id: 'ciudad_fayenza', name: 'Ciudad Fayenza', type: 'ciudad', x: 28.8, y: 54.5, postgame: false, connections: ['puente_fayenza', 'pwt', 'ruta_6', 'tunel_yakon', 'fayenza_agua_surf'] },
    { id: 'fayenza_agua_surf', name: 'Ciudad Fayenza - Agua (Surf)', type: 'zona', x: 30.6, y: 52.8, postgame: false, markerLabel: 'FS', connections: ['ciudad_fayenza'] },
    { id: 'pwt', name: 'Pokémon World Tournament', type: 'zona', x: 29.8, y: 61.3, postgame: false, connections: ['ciudad_fayenza', 'gruta_antigua'] },
    { id: 'tunel_yakon', name: 'Túnel Yakón', type: 'zona', x: 28.0, y: 45.8, postgame: true, connections: ['ciudad_fayenza', 'monte_tuerca'] },
    { id: 'ruta_6', name: 'Ruta 6', type: 'ruta', x: 21.8, y: 47.0, postgame: false, connections: ['ciudad_fayenza', 'cueva_loza', 'cueva_electrorroca', 'ciudad_loza', 'centro_estudios_estacionales', 'claro_oculto_ruta_6_norte', 'claro_oculto_ruta_6_sur'] },
    { id: 'centro_estudios_estacionales', name: 'Centro de Estudios Estacionales', type: 'zona', x: 19.8, y: 44.8, postgame: false, markerLabel: 'CE', connections: ['ruta_6'] },
    { id: 'claro_oculto_ruta_6_norte', name: 'Claro Oculto - Ruta 6 Norte', type: 'zona', x: 23.8, y: 44.2, postgame: false, markerLabel: '6N', connections: ['ruta_6'] },
    { id: 'claro_oculto_ruta_6_sur', name: 'Claro Oculto - Ruta 6 Sur', type: 'zona', x: 23.8, y: 49.2, postgame: false, markerLabel: '6S', connections: ['ruta_6'] },
    { id: 'cueva_loza', name: 'Cueva Loza', type: 'zona', x: 24.8, y: 42.3, postgame: false, connections: ['ruta_6'] },
    { id: 'cueva_electrorroca', name: 'Cueva Electrorroca', type: 'zona', x: 16.2, y: 47.4, postgame: false, connections: ['ruta_6', 'ciudad_loza'] },
    { id: 'ciudad_loza', name: 'Ciudad Loza', type: 'ciudad', x: 15.4, y: 39.8, postgame: false, connections: ['cueva_electrorroca', 'ruta_7', 'pueblo_chamota'] },
    { id: 'ruta_7', name: 'Ruta 7', type: 'ruta', x: 22.0, y: 32.5, postgame: false, connections: ['ciudad_loza', 'torre_cielos', 'monte_tuerca', 'ciudad_teja', 'claro_oculto_ruta_7'] },
    { id: 'claro_oculto_ruta_7', name: 'Claro Oculto - Ruta 7', type: 'zona', x: 24.0, y: 30.2, postgame: false, markerLabel: 'C7', connections: ['ruta_7'] },
    { id: 'torre_cielos', name: 'Torre de los Cielos', type: 'zona', x: 20.8, y: 29.8, postgame: false, connections: ['ruta_7'] },
    { id: 'pueblo_biscuit', name: 'Pueblo Biscuit', type: 'pueblo', x: 2.4, y: 17.5, postgame: false, connections: ['ciudad_mayolica'] },
    { id: 'pueblo_chamota', name: 'Pueblo Chamota', type: 'pueblo', x: 73.0, y: 39.8, postgame: false, connections: ['ciudad_loza', 'montana_reversia', 'villa_horroris'] },
    { id: 'villa_horroris', name: 'Villa Horroris', type: 'zona', x: 77.5, y: 35.0, postgame: false, connections: ['pueblo_chamota'] },
    { id: 'montana_reversia', name: 'Montaña Reversia', type: 'zona', x: 80.5, y: 39.8, postgame: false, connections: ['pueblo_chamota', 'pueblo_arenisca'] },
    { id: 'pueblo_arenisca', name: 'Pueblo Arenisca', type: 'pueblo', x: 87.6, y: 39.8, postgame: false, connections: ['montana_reversia', 'bahia_arenisca', 'ruta_13', 'ruta_14', 'gruta_marina'] },
    { id: 'bahia_arenisca', name: 'Bahía Arenisca', type: 'zona', x: 96.5, y: 39.8, postgame: false, connections: ['pueblo_arenisca', 'ruta_21'] },
    { id: 'ruta_14', name: 'Ruta 14', type: 'ruta', x: 81.0, y: 47.0, postgame: false, connections: ['pueblo_arenisca', 'santuario_abundancia', 'ciudad_negra'] },
    { id: 'santuario_abundancia', name: 'Santuario Abundancia', type: 'zona', x: 77.0, y: 45.8, postgame: false, connections: ['ruta_14'] },
    { id: 'ruta_13', name: 'Ruta 13', type: 'ruta', x: 81.0, y: 32.5, postgame: false, connections: ['pueblo_arenisca', 'pueblo_ladrillo', 'claro_oculto_ruta_13_norte', 'claro_oculto_ruta_13_sur'] },
    { id: 'claro_oculto_ruta_13_norte', name: 'Claro Oculto - Ruta 13 Norte', type: 'zona', x: 83.2, y: 30.0, postgame: false, markerLabel: '3N', connections: ['ruta_13'] },
    { id: 'claro_oculto_ruta_13_sur', name: 'Claro Oculto - Ruta 13 Sur', type: 'zona', x: 78.8, y: 34.8, postgame: false, markerLabel: '3S', connections: ['ruta_13'] },
    { id: 'pueblo_ladrillo', name: 'Pueblo Ladrillo', type: 'pueblo', x: 74.2, y: 25.5, postgame: false, connections: ['ruta_13', 'ruta_12'] },
    { id: 'ruta_12', name: 'Ruta 12', type: 'ruta', x: 69.0, y: 25.5, postgame: false, connections: ['pueblo_ladrillo', 'puente_villa'] },
    { id: 'puente_villa', name: 'Puente Villa', type: 'puente', x: 63.5, y: 25.5, postgame: false, connections: ['ruta_12', 'ruta_11'] },
    { id: 'ruta_11', name: 'Ruta 11', type: 'ruta', x: 58.0, y: 25.5, postgame: false, connections: ['puente_villa', 'ciudad_caolin'] },
    { id: 'ciudad_caolin', name: 'Ciudad Caolín', type: 'ciudad', x: 51.5, y: 25.5, postgame: false, connections: ['ruta_11', 'ruta_9'] },
    { id: 'ruta_9', name: 'Ruta 9', type: 'ruta', x: 47.0, y: 25.5, postgame: false, connections: ['ciudad_caolin', 'puente_axial', 'claro_oculto_ruta_9'] },
    { id: 'claro_oculto_ruta_9', name: 'Claro Oculto - Ruta 9', type: 'zona', x: 45.0, y: 23.3, postgame: false, markerLabel: 'C9', connections: ['ruta_9'] },
    { id: 'gruta_marina', name: 'Cueva Costera', type: 'zona', x: 91.8, y: 31.3, postgame: false, connections: ['pueblo_arenisca', 'ruta_21'] },
    { id: 'claro_oculto_ruta_22', name: 'Claro Oculto - Ruta 22', type: 'zona', x: 84.2, y: 23.2, postgame: false, markerLabel: '22', connections: ['ruta_22'] },
    { id: 'ruta_21', name: 'Ruta 21', type: 'ruta', x: 92.0, y: 26.5, postgame: false, connections: ['gruta_marina', 'ciudad_marga'] },
    { id: 'ciudad_marga', name: 'Ciudad Marga', type: 'ciudad', x: 92.0, y: 21.2, postgame: false, connections: ['ruta_21', 'ruta_22'] },
    { id: 'ruta_22', name: 'Ruta 22', type: 'ruta', x: 86.5, y: 21.2, postgame: false, connections: ['ciudad_marga', 'boquete_gigante', 'claro_oculto_ruta_22'] },
    { id: 'boquete_gigante', name: 'Boquete Gigante', type: 'zona', x: 81.2, y: 21.2, postgame: false, connections: ['ruta_22', 'ruta_23', 'claro_oculto_boquete_gigante'] },
    { id: 'claro_oculto_boquete_gigante', name: 'Claro Oculto - Boquete Gigante', type: 'zona', x: 79.0, y: 19.0, postgame: false, markerLabel: 'BG', connections: ['boquete_gigante'] },
    { id: 'ruta_23', name: 'Ruta 23', type: 'ruta', x: 76.5, y: 15.0, postgame: false, connections: ['boquete_gigante', 'calle_victoria', 'claro_oculto_ruta_23'] },
    { id: 'claro_oculto_ruta_23', name: 'Claro Oculto - Ruta 23', type: 'zona', x: 74.4, y: 12.8, postgame: false, markerLabel: '23', connections: ['ruta_23'] },
    { id: 'calle_victoria', name: 'Calle Victoria', type: 'zona', x: 72.0, y: 8.8, postgame: false, connections: ['ruta_23', 'liga_pokemon'] },
    { id: 'liga_pokemon', name: 'Liga Pokémon', type: 'zona', x: 66.2, y: 8.8, postgame: false, connections: ['calle_victoria'] },
    { id: 'puente_axial', name: 'Puente Axial', type: 'puente', x: 42.5, y: 25.5, postgame: true, connections: ['ruta_9', 'ruta_8'] },
    { id: 'ruta_8', name: 'Ruta 8', type: 'ruta', x: 36.5, y: 25.5, postgame: true, connections: ['puente_axial', 'pantano_teja', 'ciudad_teja'] },
    { id: 'pantano_teja', name: 'Pantano Teja', type: 'zona', x: 34.3, y: 21.0, postgame: true, connections: ['ruta_8'] },
    { id: 'ciudad_teja', name: 'Ciudad Teja', type: 'ciudad', x: 28.8, y: 25.5, postgame: true, connections: ['ruta_8', 'torre_duodraco', 'monte_tuerca'] },
    { id: 'torre_duodraco', name: 'Torre Duodraco', type: 'zona', x: 25.6, y: 18.2, postgame: true, connections: ['ciudad_teja'] },
    { id: 'monte_tuerca', name: 'Monte Tuerca', type: 'zona', x: 28.0, y: 32.8, postgame: true, connections: ['ciudad_teja', 'ruta_7', 'tunel_yakon'] },
    { id: 'ciudad_negra', name: 'Ciudad Negra', type: 'ciudad', x: 74.2, y: 54.5, postgame: true, connections: ['ruta_14', 'ruta_15'] },
    { id: 'ruta_15', name: 'Ruta 15', type: 'ruta', x: 69.5, y: 54.5, postgame: true, connections: ['ciudad_negra', 'lab_transfer', 'puente_progreso'] },
    { id: 'lab_transfer', name: 'Laboratorio Transfer', type: 'zona', x: 69.2, y: 50.0, postgame: true, connections: ['ruta_15'] },
    { id: 'puente_progreso', name: 'Puente Progreso', type: 'puente', x: 64.5, y: 54.5, postgame: true, connections: ['ruta_15', 'ruta_16'] },
    { id: 'puente_saeta', name: 'Puente Saeta', type: 'puente', x: 64.5, y: 72.5, postgame: true, connections: ['ciudad_porcelana', 'bosque_azulejo'] },
    { id: 'bosque_azulejo', name: 'Bosque Azulejo', type: 'zona', x: 75.8, y: 74.5, postgame: true, connections: ['puente_saeta', 'ciudad_esmalte'] },
    { id: 'ciudad_esmalte', name: 'Ciudad Esmalte', type: 'ciudad', x: 79.3, y: 70.5, postgame: true, connections: ['bosque_azulejo', 'ruta_3'] },
    { id: 'ruta_3', name: 'Ruta 3', type: 'ruta', x: 84.3, y: 70.5, postgame: true, connections: ['ciudad_esmalte', 'cueva_manantial', 'ciudad_gres'] },
    { id: 'cueva_manantial', name: 'Cueva Manantial', type: 'zona', x: 84.1, y: 65.5, postgame: true, connections: ['ruta_3'] },
    { id: 'ciudad_gres', name: 'Ciudad Gres', type: 'ciudad', x: 89.2, y: 70.5, postgame: true, connections: ['ruta_3', 'solar_suenos', 'ruta_2'] },
    { id: 'solar_suenos', name: 'Solar de los Sueños', type: 'zona', x: 93.4, y: 70.0, postgame: true, connections: ['ciudad_gres'] },
    { id: 'ruta_2', name: 'Ruta 2', type: 'ruta', x: 90.0, y: 76.5, postgame: true, connections: ['ciudad_gres', 'pueblo_terracota'] },
    { id: 'pueblo_terracota', name: 'Pueblo Terracota', type: 'pueblo', x: 90.8, y: 82.2, postgame: true, connections: ['ruta_2', 'ruta_1'] },
    { id: 'ruta_1', name: 'Ruta 1', type: 'ruta', x: 90.8, y: 88.2, postgame: true, connections: ['pueblo_terracota', 'pueblo_arcilla'] },
    { id: 'pueblo_arcilla', name: 'Pueblo Arcilla', type: 'pueblo', x: 90.8, y: 94.2, postgame: true, connections: ['ruta_1', 'ruta_17'] },
    { id: 'ruta_17', name: 'Ruta 17', type: 'ruta', x: 86.0, y: 94.2, postgame: true, connections: ['pueblo_arcilla', 'ruta_18', 'laboratorio_pp'] },
    { id: 'ruta_18', name: 'Ruta 18', type: 'ruta', x: 80.5, y: 94.2, postgame: true, connections: ['ruta_17'] },
    { id: 'laboratorio_pp', name: 'Laboratorio P+P', type: 'zona', x: 83.6, y: 90.2, postgame: true, connections: ['ruta_17'] }
];
const V2_GYM_LOCATIONS = [
    { number: '1', city: 'Ciudad Engobe', id: 'ciudad_engobe' },
    { number: '2', city: 'Ciudad Hormigón', id: 'ciudad_hormigon' },
    { number: '3', city: 'Ciudad Porcelana', id: 'ciudad_porcelana' },
    { number: '4', city: 'Ciudad Mayólica', id: 'ciudad_mayolica' },
    { number: '5', city: 'Ciudad Fayenza', id: 'ciudad_fayenza' },
    { number: '6', city: 'Ciudad Loza', id: 'ciudad_loza' },
    { number: '7', city: 'Ciudad Caolín', id: 'ciudad_caolin' },
    { number: '8', city: 'Ciudad Marga', id: 'ciudad_marga' }
];
const V2_MAP_LOCATION_ALIASES = {
    ciudad_engobe: ['Inicial', 'Engobe'],
    rancho_ocre: ['Rancho'],
    cloacas_porcelana: ['Alcantarillas'],
    gruta_antigua: ['Gruta Antigua', 'Pasadizo', 'Reliquia'],
    parque_porcelana: ['Parque'],
    zona_desierto: ['Zona Desértica', 'Desértica'],
    castillo_ancestral: ['Castillo', 'Ancestral'],
    bosque_perdido: ['Bosque', 'Perdido', 'Perdidos'],
    centro_estudios_estacionales: ['Centro Estudios Estacionales', 'Centro de Estudios'],
    cueva_electrorroca: ['Electrorroca'],
    torre_cielos: ['Cielos'],
    villa_horroris: ['Villa', 'Horroris'],
    montana_reversia: ['Reversia'],
    pueblo_arenisca: ['Arenisca'],
    pueblo_ladrillo: ['Ladrillo'],
    gruta_marina: ['Gruta Marina', 'Costera', 'Cueva Costera'],
    ruta_21: ['Costera'],
    boquete_gigante: ['Gigante'],
    calle_victoria: ['Victoria']
};

function mapV2Percent(location) {
    return [
        V2_MAP_SIZE.height * (1 - location.y / 100),
        V2_MAP_SIZE.width * (location.x / 100)
    ];
}

function getKalosMapLocation(route) {
    const normalizedRoute = normalizeRouteKeyword(route);
    const exactMatch = KALOS_CAPTURE_LOCATIONS.find(location =>
        location.aliases.some(alias => normalizeRouteKeyword(alias) === normalizedRoute));
    if(exactMatch) return exactMatch;
    return KALOS_CAPTURE_LOCATIONS.find(location => location.aliases.some(alias => {
        const normalizedAlias = normalizeRouteKeyword(alias);
        return normalizedRoute === normalizedAlias || normalizedRoute.startsWith(`${normalizedAlias} `);
    }));
}

function createMapPopup(title, status, records = [], encounters = [], showCaptureRoutes = false) {
    const popup = document.createElement('div');
    const heading = document.createElement('div');
    heading.className = 'map-popup-title';
    heading.textContent = title;
    popup.appendChild(heading);
    const statusLine = document.createElement('div');
    statusLine.className = 'map-popup-status';
    statusLine.textContent = status;
    popup.appendChild(statusLine);
    const appendPokemon = record => {
        const pokemon = document.createElement('div');
        pokemon.className = 'map-popup-pokemon';
        const sprite = document.createElement('img');
        sprite.className = 'map-popup-sprite pixel-art';
        sprite.src = getPokemonSpriteUrl(record);
        sprite.alt = `Sprite animado de ${record.especie}`;
        sprite.dataset.speciesName = record.especie;
        sprite.dataset.shiny = String(!!record.shiny);
        sprite.onerror = () => window.pokemonSpriteFallback(sprite);
        const info = document.createElement('div');
        info.className = 'map-popup-pokemon-info';
        const nickname = document.createElement('strong');
        nickname.textContent = record.mote || record.especie;
        const species = document.createElement('span');
        species.textContent = `${record.especie}${record.shiny ? ' · Shiny' : ''}${record.estado !== 'Vivo' ? ` · ${record.estado.toLowerCase()}` : ''}`;
        info.append(nickname, species);
        if(showCaptureRoutes && record.ruta) {
            const captureRoute = document.createElement('span');
            captureRoute.className = 'text-xs text-slate-500';
            captureRoute.textContent = record.ruta;
            info.appendChild(captureRoute);
        }
        pokemon.append(sprite, info);
        return pokemon;
    };
    encounters.forEach(encounter => {
        const section = document.createElement('div');
        section.className = 'map-popup-encounter';
        const encounterStatus = document.createElement('div');
        encounterStatus.className = 'map-popup-encounter-title';
        encounterStatus.textContent = encounter.repeatable && encounter.records.length
            ? `🦴 ${encounter.name} · ${encounter.records.length} fósil${encounter.records.length === 1 ? '' : 'es'} capturado${encounter.records.length === 1 ? '' : 's'}`
            : encounter.records.length
            ? `✅ ${encounter.name} · Capturada`
            : encounter.failedRoutes.length
                ? `❌ ${encounter.name} · Fallida`
                : `⏳ ${encounter.name} · Pendiente`;
        section.appendChild(encounterStatus);
        encounter.records.forEach(record => section.appendChild(appendPokemon(record)));
        popup.appendChild(section);
    });
    records.forEach(record => popup.appendChild(appendPokemon(record)));
    return popup;
}

const KALOS_MARKER_LABELS = {
    'Inicial · Pueblo Boceto': 'IN',
    'Bosque Novarte': 'BN',
    'Ciudad Luminalia · Laboratorio': 'CL',
    'Palacio Cenit': 'PC',
    'Gruta Tierraunida': 'GT',
    'Pueblo Vánitas': 'PV',
    'Pueblo Petroglifo': 'PP',
    'Cueva Brillante': 'CB',
    'Ciudad Relieve': 'CR',
    'Cueva Reflejos': 'REF',
    'Ciudad Yantra · Torre Maestría': 'CY',
    'Bahía Azul': 'BA',
    'Hotel Desolación': 'HD',
    'Gruta Helada': 'GH',
    'Cueva Desenlace': 'CD',
    'Villa Pokémon': 'VP',
    'Calle Victoria': 'CV'
};

const KALOS_CAPTURE_SLOTS = Object.entries(OG_GYM_ROUTES).flatMap(([gymNumber, areas]) =>
    areas.map(area => {
        const location = getKalosMapLocation(area.locations[0]);
        const locationLabel = OG_ROUTE_LOCATION_LABELS[area.locations[0]]
            || area.locations[0].replace(/\b\w/g, character => character.toUpperCase());
        const habitatLabel = area.habitats[0]
            ? area.habitats[0].replace(/\b\w/g, character => character.toUpperCase())
            : '';
        const canonicalLabel = area.label || (habitatLabel ? `${locationLabel} - ${habitatLabel}` : locationLabel);
        const aliases = [canonicalLabel, ...area.suggestions];
        if(!area.habitats.length) aliases.push(...area.locations);
        aliases.push(...area.aliases);
        return {
            location,
            name: habitatLabel || area.label || locationLabel,
            progressName: canonicalLabel,
            aliases: [...new Set(aliases)],
            repeatable: area.repeatable,
            gymStage: gymNumber === 'league' ? 9 : Number(gymNumber)
        };
    })
).filter(slot => slot.location);

function getKalosMapEncounterSlot(route, location) {
    const normalizedRoute = normalizeRouteKeyword(route);
    const exactSlot = KALOS_CAPTURE_SLOTS.find(slot => slot.location === location &&
        slot.aliases.some(alias => normalizeRouteKeyword(alias) === normalizedRoute));
    if(exactSlot) return exactSlot;
    if(getKalosMapLocation(route) !== location) return undefined;
    const locationSlots = KALOS_CAPTURE_SLOTS.filter(slot => slot.location === location);
    return locationSlots.length === 1
        ? locationSlots[0]
        : locationSlots.find(slot => normalizeRouteKeyword(slot.name) === 'hierba normal');
}

function isKalosCaptureSlotCompleted(slot, captures, failures) {
    return captures.some(record => getKalosMapEncounterSlot(record.ruta, slot.location) === slot)
        || failures.some(route => getKalosMapEncounterSlot(route, slot.location) === slot);
}

function isOgRepeatableCapture(route) {
    const normalizedRoute = normalizeRouteKeyword(route);
    return Object.values(OG_GYM_ROUTES).flat().some(area =>
        area.repeatable &&
        [area.label, ...area.suggestions, ...area.locations, ...area.aliases]
            .some(alias => normalizeRouteKeyword(alias) === normalizedRoute));
}

function addKalosMapMarkers(player) {
    if(!kalosMapMarkers) return;
    kalosMapMarkers.clearLayers();
    const captures = globalData.filter(record => record.jugador === player);
    const failures = globalFailedRoutes[player] || [];
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const zoomIncrease = Math.max(0, kalosMapInstance.getZoom() - kalosMapBaseZoom);
    const markerScale = Math.min(isMobile ? 1.9 : 1.6, (isMobile ? 1.15 : 1) * Math.pow(1.18, zoomIncrease));

    KALOS_CAPTURE_LOCATIONS.forEach(location => {
        const locationSlots = KALOS_CAPTURE_SLOTS.filter(slot => slot.location === location);
        if(!locationSlots.length) return;
        const encounters = locationSlots.map(slot => ({
            ...slot,
            records: captures.filter(record => getKalosMapEncounterSlot(record.ruta, location) === slot),
            failedRoutes: failures.filter(route => getKalosMapEncounterSlot(route, location) === slot)
        }));
        const capturedCount = encounters.filter(encounter => encounter.records.length > 0).length;
        const failedCount = encounters.filter(encounter => encounter.failedRoutes.length > 0).length;
        const completedCount = encounters.filter(encounter =>
            encounter.records.length > 0 || encounter.failedRoutes.length > 0).length;
        const unassignedRecords = captures.filter(record =>
            getKalosMapLocation(record.ruta) === location && !getKalosMapEncounterSlot(record.ruta, location));
        const unassignedFailures = failures.filter(route =>
            getKalosMapLocation(route) === location && !getKalosMapEncounterSlot(route, location));
        const state = completedCount === encounters.length && completedCount > 0 ? 'complete'
            : capturedCount > 0 || unassignedRecords.length ? 'partial'
            : failedCount > 0 || unassignedFailures.length ? 'failed' : 'available';
        const routeNumber = location.name.match(/^Ruta (\d+)$/);
        const markerLabel = routeNumber ? routeNumber[1] : KALOS_MARKER_LABELS[location.name];
        const pin = L.divIcon({
            className: 'map-route-marker',
            html: `<div class="map-route-pin is-${state}" style="--map-marker-scale:${markerScale}"><span>${markerLabel}</span></div>`,
            iconSize: [Math.round(34 * markerScale), Math.round(34 * markerScale)],
            iconAnchor: [Math.round(17 * markerScale), Math.round(29 * markerScale)],
            popupAnchor: [0, Math.round(-28 * markerScale)]
        });
        let status = `${completedCount} de ${encounters.length} capturas completadas (${capturedCount} capturadas, ${failedCount} fallidas).`;
        if(unassignedRecords.length) status += ` ${unassignedRecords.length} captura(s) sin zona identificada.`;
        if(unassignedFailures.length) status += ` ${unassignedFailures.length} intento(s) fallido(s) sin zona identificada.`;
        L.marker(location.coords, { icon: pin })
            .bindPopup(createMapPopup(location.name, status, unassignedRecords, encounters), {
                autoPan: true,
                autoPanPaddingTopLeft: [40, 80],
                autoPanPaddingBottomRight: [40, 40],
                keepInView: true,
                maxWidth: 280,
                closeButton: true
            })
            .addTo(kalosMapMarkers);
    });

    const badges = globalBadges[player] || {};
    KALOS_GYM_LOCATIONS.forEach(gym => {
        const earned = badges[`b${gym.number}`] === true;
        const badge = GYM_BADGES.find(item => item.id === `b${gym.number}`);
        const pin = L.divIcon({
            className: 'map-gym-marker',
            html: `<div class="map-gym-pin is-${earned ? 'earned' : 'pending'}" style="--map-marker-scale:${markerScale}">${earned ? '★' : gym.number}</div>`,
            iconSize: [Math.round(27 * markerScale), Math.round(27 * markerScale)],
            iconAnchor: [Math.round(13 * markerScale), Math.round(13 * markerScale)],
            popupAnchor: [0, Math.round(-12 * markerScale)]
        });
        L.marker(gym.coords, { icon: pin })
            .bindPopup(createMapPopup(
                `${gym.number}.º gimnasio · ${gym.city}`,
                `${earned ? '🏅 Medalla conseguida' : '🔒 Medalla pendiente'}${badge ? ` · ${badge.name}` : ''}`
            ), {
                autoPan: true,
                autoPanPaddingTopLeft: [40, 80],
                autoPanPaddingBottomRight: [40, 40],
                keepInView: true,
                maxWidth: 280,
                closeButton: true
            })
            .addTo(kalosMapMarkers);
    });

    const unlocatedCaptures = captures.filter(record => !getKalosMapLocation(record.ruta));
    const unlocatedFailures = failures.filter(route => !getKalosMapLocation(route));
    const unlocated = document.getElementById('map-unlocated-records');
    unlocated.replaceChildren();
    if(unlocatedCaptures.length || unlocatedFailures.length) {
        unlocated.classList.remove('hidden');
        const title = document.createElement('strong');
        title.textContent = 'Registros sin ubicación reconocida en este mapa';
        unlocated.appendChild(title);
        const list = document.createElement('ul');
        list.className = 'list-disc pl-5 mt-1';
        unlocatedCaptures.forEach(record => {
            const item = document.createElement('li');
            item.textContent = `${record.ruta}: ${record.mote || record.especie} (${record.especie})`;
            list.appendChild(item);
        });
        unlocatedFailures.forEach(route => {
            const item = document.createElement('li');
            item.textContent = `${route}: captura fallida`;
            list.appendChild(item);
        });
        unlocated.appendChild(list);
    } else {
        unlocated.classList.add('hidden');
    }
}

function v2MapLocationMatches(route, location) {
    const normalizedRoute = normalizeRouteKeyword(route);
    const prefixes = ['ciudad', 'pueblo', 'ruta', 'zona', 'puente'];
    const aliases = [
        location.name,
        location.id.replace(/_/g, ' '),
        ...(V2_MAP_LOCATION_ALIASES[location.id] || [])
    ]
        .map(normalizeRouteKeyword);
    const shortenedAliases = aliases.map(alias => {
        const prefix = prefixes.find(candidate => alias.startsWith(`${candidate} `));
        return prefix ? alias.slice(prefix.length + 1) : alias;
    });
    return [...aliases, ...shortenedAliases].some(alias =>
        normalizedRoute === alias || normalizedRoute.startsWith(`${alias} `)
    );
}

function getV2MapLocation(route) {
    const captureArea = getV2CaptureArea(route, normalizeRouteKeyword);
    if(captureArea) {
        const captureLocation = V2_MAP_LOCATIONS.find(location => location.id === captureArea.mapLocationId);
        if(captureLocation) return captureLocation;
    }
    return V2_MAP_LOCATIONS.find(location => v2MapLocationMatches(route, location));
}

function addV2MapMarkers(player) {
    if(!kalosMapMarkers) return;
    kalosMapMarkers.clearLayers();
    const captures = globalData.filter(record => record.jugador === player);
    const failures = globalFailedRoutes[player] || [];
    const locationsById = new Map(V2_MAP_LOCATIONS.map(location => [location.id, location]));
    const locationStatus = new Map();
    const capturesByLocation = new Map(V2_MAP_LOCATIONS.map(location => [location.id, []]));
    const failuresByLocation = new Map(V2_MAP_LOCATIONS.map(location => [location.id, []]));
    const unlocatedCaptures = [];
    const unlocatedFailures = [];
    captures.forEach(record => {
        const location = getV2MapLocation(record.ruta);
        if(location) capturesByLocation.get(location.id).push(record);
        else unlocatedCaptures.push(record);
    });
    failures.forEach(route => {
        const location = getV2MapLocation(route);
        if(location) failuresByLocation.get(location.id).push(route);
        else unlocatedFailures.push(route);
    });
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const zoomIncrease = Math.max(0, kalosMapInstance.getZoom() - kalosMapBaseZoom);
    const markerScale = Math.min(isMobile ? 1.65 : 1.45, (isMobile ? 1.05 : 0.9) * Math.pow(1.15, zoomIncrease));

    V2_MAP_LOCATIONS.forEach(location => {
        const records = capturesByLocation.get(location.id);
        const failedRoutes = failuresByLocation.get(location.id);
        const hasCapture = records.length > 0;
        const hasFailure = failedRoutes.length > 0;
        const state = hasCapture && hasFailure ? 'partial'
            : hasCapture ? 'captured'
            : hasFailure ? 'failed' : 'available';
        locationStatus.set(location.id, hasCapture || hasFailure);
        const routeNumber = location.type === 'ruta' ? location.name.match(/^Ruta (\d+)$/) : null;
        const label = location.markerLabel || (routeNumber
            ? routeNumber[1]
            : location.name.split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase());
        const postgameClass = location.postgame ? ' is-postgame' : '';
        const pin = L.divIcon({
            className: 'map-route-marker',
            html: `<div class="map-v2-marker type-${location.type} is-${state}${postgameClass}" style="--map-marker-scale:${markerScale}"><span>${label}</span></div>`,
            iconSize: [Math.round(28 * markerScale), Math.round(28 * markerScale)],
            iconAnchor: [Math.round(14 * markerScale), Math.round(14 * markerScale)],
            popupAnchor: [0, Math.round(-14 * markerScale)]
        });
        let status = hasCapture && hasFailure
            ? `${records.length} captura(s) registrada(s) y ${failedRoutes.length} intento(s) fallido(s).`
            : hasCapture ? `${records.length} captura(s) registrada(s).`
            : hasFailure ? 'Captura fallida; esta ubicación ya está completada.'
            : 'Captura pendiente.';
        if(location.postgame) status += ' Zona postgame.';
        L.marker(mapV2Percent(location), { icon: pin })
            .bindPopup(createMapPopup(location.name, status, records, [], true), {
                autoPan: true,
                autoPanPaddingTopLeft: [40, 80],
                autoPanPaddingBottomRight: [40, 40],
                keepInView: true,
                maxWidth: 280,
                closeButton: true
            })
            .addTo(kalosMapMarkers);
    });

    const drawnConnections = new Set();
    V2_MAP_LOCATIONS.forEach(location => {
        location.connections.forEach(connectionId => {
            const connectedLocation = locationsById.get(connectionId);
            if(!connectedLocation) {
                console.warn(`La ubicación ${location.id} conecta con una ubicación desconocida: ${connectionId}.`);
                return;
            }
            const connectionKey = [location.id, connectionId].sort().join('|');
            if(drawnConnections.has(connectionKey)) return;
            drawnConnections.add(connectionKey);
            const completed = locationStatus.get(location.id) && locationStatus.get(connectionId);
            L.polyline([mapV2Percent(location), mapV2Percent(connectedLocation)], {
                color: completed ? '#16a34a' : '#facc15',
                weight: 4,
                opacity: 0.82,
                lineCap: 'round',
                dashArray: location.postgame || connectedLocation.postgame ? '7 7' : null,
                interactive: false
            }).addTo(kalosMapMarkers);
        });
    });

    const badges = globalBadges[player] || {};
    V2_GYM_LOCATIONS.forEach(gym => {
        const location = locationsById.get(gym.id);
        if(!location) return;
        const earned = badges[`b${gym.number}`] === true;
        const badge = GYM_BADGES.find(item => item.id === `b${gym.number}`);
        const pin = L.divIcon({
            className: 'map-gym-marker',
            html: `<div class="map-gym-pin is-${earned ? 'earned' : 'pending'}" style="--map-marker-scale:${markerScale}">${earned ? '★' : gym.number}</div>`,
            iconSize: [Math.round(27 * markerScale), Math.round(27 * markerScale)],
            iconAnchor: [Math.round(13 * markerScale), Math.round(13 * markerScale)],
            popupAnchor: [0, Math.round(-12 * markerScale)]
        });
        L.marker(mapV2Percent(location), { icon: pin })
            .bindPopup(createMapPopup(
                `${gym.number}.º gimnasio · ${gym.city}`,
                `${earned ? '🏅 Medalla conseguida' : '🔒 Medalla pendiente'}${badge ? ` · ${badge.name}` : ''}`
            ), {
                autoPan: true,
                autoPanPaddingTopLeft: [40, 80],
                autoPanPaddingBottomRight: [40, 40],
                keepInView: true,
                maxWidth: 280,
                closeButton: true
            })
            .addTo(kalosMapMarkers);
    });

    const unlocated = document.getElementById('map-unlocated-records');
    unlocated.replaceChildren();
    if(unlocatedCaptures.length || unlocatedFailures.length) {
        unlocated.classList.remove('hidden');
        const title = document.createElement('strong');
        title.textContent = 'Registros sin ubicación reconocida en este mapa';
        unlocated.appendChild(title);
        const list = document.createElement('ul');
        list.className = 'list-disc pl-5 mt-1';
        unlocatedCaptures.forEach(record => {
            const item = document.createElement('li');
            item.textContent = `${record.ruta}: ${record.mote || record.especie} (${record.especie})`;
            list.appendChild(item);
        });
        unlocatedFailures.forEach(route => {
            const item = document.createElement('li');
            item.textContent = `${route}: captura fallida`;
            list.appendChild(item);
        });
        unlocated.appendChild(list);
    } else {
        unlocated.classList.add('hidden');
    }
}

function addActiveMapMarkers(player) {
    if(currentLocke === 'PawPatrolOG') addKalosMapMarkers(player);
    else addV2MapMarkers(player);
}

window.updateKalosMap = function() {
    if(currentLocke !== 'PawPatrolOG' && currentLocke !== 'PawPatrolV2') return;
    const mapTitle = document.getElementById('map-title');
    if(mapTitle) mapTitle.textContent = currentLocke === 'PawPatrolOG' ? '🗺️ MAPA DE KALOS' : '🗺️ MAPA DE TESELIA';
    const errorMessage = document.getElementById('map-error-message');
    if(!window.L) {
        console.error(`Leaflet no está disponible; no se puede inicializar el mapa de ${currentLocke === 'PawPatrolOG' ? 'Kalos' : 'Teselia'}.`);
        errorMessage.textContent = 'No se pudo cargar Leaflet. Comprueba tu conexión e inténtalo de nuevo.';
        errorMessage.classList.remove('hidden');
        return;
    }
    errorMessage.classList.add('hidden');

    if(kalosMapInstance && kalosMapLocke !== currentLocke) {
        kalosMapInstance.remove();
        kalosMapInstance = null;
        kalosMapMarkers = null;
        kalosMapBaseZoom = null;
    }

    const selector = document.getElementById('map-player-selector');
    const players = LOCKE_PLAYERS[currentLocke] || [];
    const selectedPlayer = players.includes(selector.value) ? selector.value
        : players.includes(currentPlayer) ? currentPlayer : players[0];
    selector.replaceChildren(...players.map(player => new Option(player, player)));
    selector.value = selectedPlayer;

    const mapBounds = currentLocke === 'PawPatrolOG' ? KALOS_MAP_BOUNDS : V2_MAP_BOUNDS;
    const mapImage = currentLocke === 'PawPatrolOG' ? 'KalosMap.jpg' : 'MapaPkN2.jpg';
    let shouldFitMap = false;
    if(!kalosMapInstance) {
        kalosMapInstance = L.map('kalos-map', {
            crs: L.CRS.Simple,
            minZoom: -1.5,
            maxZoom: 2,
            zoomSnap: 0.25,
            zoomDelta: 0.5,
            maxBounds: mapBounds,
            maxBoundsViscosity: 1
        });
        L.imageOverlay(mapImage, mapBounds).addTo(kalosMapInstance);
        kalosMapMarkers = L.layerGroup().addTo(kalosMapInstance);
        kalosMapInstance.fitBounds(mapBounds);
        kalosMapBaseZoom = kalosMapInstance.getZoom();
        kalosMapInstance.setMinZoom(kalosMapBaseZoom);
        kalosMapLocke = currentLocke;
        kalosMapInstance.on('zoomend', () => addActiveMapMarkers(selector.value));
        shouldFitMap = true;
    }
    requestAnimationFrame(() => {
        kalosMapInstance.invalidateSize();
        if(shouldFitMap) {
            kalosMapInstance.fitBounds(mapBounds);
            kalosMapBaseZoom = kalosMapInstance.getZoom();
            kalosMapInstance.setMinZoom(kalosMapBaseZoom);
            if(document.body.classList.contains('map-fullscreen')) {
                const fillZoom = kalosMapInstance.getBoundsZoom(mapBounds, true);
                kalosMapInstance.setZoom(Math.max(kalosMapBaseZoom, fillZoom));
            }
            addActiveMapMarkers(selectedPlayer);
        }
    });
    addActiveMapMarkers(selectedPlayer);
};

function routeHasKeyword(route, keyword) {
    const normalizedRoute = ` ${normalizeRouteKeyword(route)} `;
    const normalizedKeyword = normalizeRouteKeyword(keyword);
    return normalizedKeyword && normalizedRoute.includes(` ${normalizedKeyword} `);
}

function routeMatchesOgLocation(route, keyword) {
    if(normalizeRouteKeyword(keyword) === 'inicial') {
        return normalizeRouteKeyword(route) === 'inicial';
    }
    return routeHasKeyword(route, keyword);
}

function isPokemonAllowedForOgGym(pokemonRoute, gymNumber) {
    if(!gymNumber || isOgRepeatableCapture(pokemonRoute)) return true;
    const finalStage = gymNumber === 'league' ? 8 : parseInt(gymNumber, 10);
    const allowedAreas = [];
    for(let stage = 1; stage <= finalStage; stage++) {
        allowedAreas.push(...(OG_GYM_ROUTES[stage.toString()] || []));
    }
    if(gymNumber === 'league') allowedAreas.push(...OG_GYM_ROUTES.league);
    const routeHasHabitat = Object.values(OG_GYM_ROUTES).flat()
        .some(area => area.habitats.some(keyword => routeHasKeyword(pokemonRoute, keyword)));
    return allowedAreas.some(area =>
        area.locations.some(keyword => routeMatchesOgLocation(pokemonRoute, keyword)) &&
        (!area.habitats.length || !routeHasHabitat ||
            area.habitats.every(keyword => routeHasKeyword(pokemonRoute, keyword)))
    );
}

// Función para obtener todas las rutas permitidas hasta un gimnasio específico
function getAllowedRoutesForGym(gymNumber) {
    const gymLimit = gymNumber === 'league' ? 9 : Number(gymNumber);
    return V2_CAPTURE_AREAS.filter(area => area.gym <= gymLimit);
}

function getLegacyAllowedRoutesForGym(gymNumber) {
    const gymLimit = gymNumber === 'league' ? 8 : Number(gymNumber);
    const routes = [];
    for(let stage = 1; stage <= gymLimit; stage++) {
        routes.push(...(V2_LEGACY_GYM_ROUTE_KEYWORDS[stage.toString()] || []));
    }
    if(gymNumber === 'league') routes.push(...V2_LEGACY_GYM_ROUTE_KEYWORDS.league);
    return routes;
}

// Función para verificar si un Pokémon puede usarse en un gimnasio
function isPokemonAllowedForGym(pokemonRoute, gymNumber) {
    if(currentLocke === 'PawPatrolOG') return isPokemonAllowedForOgGym(pokemonRoute, gymNumber);
    if (!gymNumber) return true; // Si no se seleccionó gimnasio, permitir todos
    const captureArea = getV2CaptureArea(pokemonRoute, normalizeRouteKeyword);
    if(captureArea) return getAllowedRoutesForGym(gymNumber).includes(captureArea);
    return getLegacyAllowedRoutesForGym(gymNumber).some(keyword => routeHasKeyword(pokemonRoute, keyword));
}

// --- 2. DICCIONARIO UNIVERSAL (100% DE ATAQUES, OBJETOS Y HABILIDADES) ---
let dictTraductores = { moves: {}, abilities: {}, items: {}, natures: {} };
let validLists = { moves: [], abilities: [], items: [], natures: [] };

function normalizeDictionaryEntry(value) {
    return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

async function loadUniversalDictionaries() {
    // Naturalezas
    const natures = { "firme": "Adamant", "alegre": "Jolly", "miedosa": "Timid", "modesta": "Modest", "osada": "Bold", "agitada": "Impish", "cauta": "Careful", "serena": "Calm", "grosera": "Sassy", "mansa": "Quiet", "audaz": "Brave", "plácida": "Relaxed", "ingenua": "Naive", "pícara": "Naughty", "activa": "Hasty", "fuerte": "Hardy", "dócil": "Docile", "seria": "Serious", "tímida": "Bashful", "rara": "Quirky", "huraña": "Lonely", "afable": "Mild", "amable": "Gentle", "floja": "Lax", "alocada": "Rash" };
    for(let es in natures) {
        const normalizedNature = normalizeDictionaryEntry(es);
        dictTraductores.natures[normalizedNature] = natures[es];
        dictTraductores.natures[normalizeDictionaryEntry(natures[es])] = natures[es];
        validLists.natures.push(es.toLowerCase());
    }
    document.getElementById('valid-natures-list').innerHTML = Object.keys(natures).sort().map(m => `<option value="${m.charAt(0).toUpperCase() + m.slice(1)}">`).join('');

    const responses = await Promise.all([
        fetch('https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv/move_names.csv'),
        fetch('https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv/ability_names.csv'),
        fetch('https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv/item_names.csv')
    ]);
    const failures = responses.filter(response => !response.ok);
    if(failures.length) {
        throw new Error(`No se pudieron cargar los diccionarios de traducción (HTTP ${failures.map(response => response.status).join(', ')}).`);
    }
    const [movesCsv, abilitiesCsv, itemsCsv] = await Promise.all(responses.map(response => response.text()));
    parseUniversalCSV(movesCsv, 'moves', 'all-moves-list');
    parseUniversalCSV(abilitiesCsv, 'abilities', 'valid-abilities-list');
    parseUniversalCSV(itemsCsv, 'items', 'valid-items-list');
}

function parseUniversalCSV(csvText, category, datalistId) {
    const lines = csvText.split(/\r?\n/); const esNames = {}; const enNames = {};
    for(let i=1; i<lines.length; i++) {
        const match = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if(match.length >= 3) {
            const id = match[0].trim(); const lang = match[1].trim();
            const name = match[2].replace(/^"|"$/g, '').replace(/""/g, '"').trim();
            if(lang === '7') esNames[id] = name; // Español
            if(lang === '9') enNames[id] = name; // Inglés
        }
    }
    const opcionesEspanol = [];
    for(let id in esNames) {
        if(enNames[id]) {
            dictTraductores[category][normalizeDictionaryEntry(esNames[id])] = enNames[id];
            dictTraductores[category][normalizeDictionaryEntry(enNames[id])] = enNames[id];
            opcionesEspanol.push(esNames[id]);
            validLists[category].push(esNames[id].toLowerCase());
        }
    }
    const dl = document.getElementById(datalistId);
    if(dl) dl.innerHTML = opcionesEspanol.sort().map(m => `<option value="${m}">`).join('');
}

// Sistema anti-tildes y anti-mayúsculas para validar a prueba de tontos
function validarEntrada(input, category, fieldName) {
    const raw = input.trim(); if(!raw) return "";
    const normalizedInput = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    let coincidenciaExacta = null;
    for(let validWord of validLists[category]) {
        if(validWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === normalizedInput) {
            coincidenciaExacta = validWord; break;
        }
    }
    if(!coincidenciaExacta) throw new Error(`El ${fieldName} "${raw}" no existe. Selecciónalo de las sugerencias.`);
    return coincidenciaExacta.charAt(0).toUpperCase() + coincidenciaExacta.slice(1); // Lo guarda bonito y con tilde
}

function traducirAlIngles(esWord, category) {
    if(!esWord) return "";
    const word = esWord.trim();
    if(category === 'natures') {
        return dictTraductores.natures[normalizeDictionaryEntry(word)] || word;
    }
    return dictTraductores[category][normalizeDictionaryEntry(word)] || word;
}

const universalDictionariesReady = loadUniversalDictionaries();
universalDictionariesReady.catch(error => console.error('Error cargando los diccionarios Showdown:', error));

// --- SISTEMA GENERAL ---
function getMyPlayer() { return currentPlayer; }
function lockePath(path = '') { return path ? `lockes/${currentLocke}/${path}` : `lockes/${currentLocke}`; }
function getUsersPath() { return lockePath('usuarios'); }
function userPath(path = '') { return path ? `${getUsersPath()}/${path}` : getUsersPath(); }
function dailyGachaKey(player) { return currentLocke === 'PawPatrolOG' ? `dailyGacha_${player}_PawPatrolOG` : `dailyGacha_${player}`; }
async function migrateLegacyV2Data() {
    const worldRef = ref(db, 'lockes/PawPatrolV2');
    const migration = await get(ref(db, 'lockes/PawPatrolV2/legacyMigrationCompleted'));
    if(!migration.val()) {
        const [legacyUsers, legacySuggestions] = await Promise.all([
            get(ref(db, 'usuarios')),
            get(ref(db, 'sugerencias'))
        ]);
        const users = legacyUsers.val() || {};
        const suggestions = legacySuggestions.val() || {};
        const result = await runTransaction(worldRef, current => {
            const next = current || {};
            if(next.legacyMigrationCompleted) return next;
            next.usuarios = { ...users, ...(next.usuarios || {}) };
            next.sugerencias = { ...suggestions, ...(next.sugerencias || {}) };
            next.legacyMigrationCompleted = true;
            return next;
        }, { applyLocally: false });
        if(!result.committed) throw new Error('No se pudo completar la migración segura de los datos antiguos a PawPatrolV2.');
    }
    try {
        const [legacyUsers, currentUsers, legacySuggestions, currentSuggestions] = await Promise.all([
            get(ref(db, 'usuarios')),
            get(ref(db, 'lockes/PawPatrolV2/usuarios')),
            get(ref(db, 'sugerencias')),
            get(ref(db, 'lockes/PawPatrolV2/sugerencias'))
        ]);
        const oldUsers = legacyUsers.val() || {};
        const v2Users = currentUsers.val() || {};
        const duplicatePlayers = Object.keys(oldUsers).filter(player =>
            Object.prototype.hasOwnProperty.call(v2Users, player) &&
            JSON.stringify(oldUsers[player]) === JSON.stringify(v2Users[player])
        );
        await Promise.all(duplicatePlayers.map(player => remove(ref(db, `usuarios/${player}`))));
        if(JSON.stringify(legacySuggestions.val() || {}) === JSON.stringify(currentSuggestions.val() || {})) {
            await remove(ref(db, 'sugerencias'));
        } else if(legacySuggestions.exists()) {
            console.warn('Se conservaron sugerencias antiguas porque difieren de las de PawPatrolV2.');
        }
        const retainedPlayers = Object.keys(oldUsers).filter(player => !duplicatePlayers.includes(player));
        if(retainedPlayers.length) {
            console.warn('Se conservaron usuarios antiguos con datos distintos a PawPatrolV2:', retainedPlayers);
        }
    } catch(error) {
        console.warn('La migración está completa, pero no se pudieron limpiar las copias idénticas antiguas:', error);
    }
}
function writeLog(jugador, logText) { if(db&&jugador) push(ref(db, userPath(`${jugador}/logregister`)), { fecha: new Date().toLocaleDateString('es-ES')+" "+new Date().toLocaleTimeString('es-ES'), detalle: logText }); }
function addPoints(jugador, amount) {
    if(db && jugador) {
        const newPoints = Math.max(0, (globalEco[jugador] || 0) + amount);
        console.log(`Actualizando puntos para ${jugador}: ${globalEco[jugador] || 0} + ${amount} = ${newPoints}`);
        set(ref(db, userPath(`${jugador}/economia/puntos`)), newPoints)
            .then(() => {
                console.log(`✅ Puntos actualizados correctamente: ${newPoints}`);
            })
            .catch((error) => {
                console.error('❌ Error al actualizar puntos:', error);
            });
    }
}

function setAuthMessage(message, isError = false) {
    const element = document.getElementById('auth-message');
    element.innerText = message;
    element.classList.toggle('hidden', !message);
    element.classList.toggle('text-red-300', isError);
    element.classList.toggle('text-amber-200', !isError);
}

function transitionToScreen(name) {
    document.body.classList.toggle('map-fullscreen', name === 'map' &&
        (currentLocke === 'PawPatrolOG' || currentLocke === 'PawPatrolV2'));
    document.querySelectorAll('[id^="screen-"]').forEach(screen => {
        screen.classList.add('hidden');
        screen.classList.remove('flex');
        screen.classList.remove('screen-transition-enter', 'screen-transition-active');
    });
    const screen = document.getElementById(`screen-${name}`);
    if(screen) {
        screen.classList.remove('hidden');
        screen.classList.add('flex');
        screen.classList.add('screen-transition-enter');
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if(!screen.isConnected) return;
            screen.classList.add('screen-transition-active');
        }));
        const finishTransition = event => {
            if(event.target !== screen) return;
            screen.classList.remove('screen-transition-enter', 'screen-transition-active');
            screen.removeEventListener('transitionend', finishTransition);
        };
        screen.addEventListener('transitionend', finishTransition);
    }
    currentScreen = name;
    updateProfileActions();
}
function showOnlyScreen(name) { transitionToScreen(name); }

function updateProfileActions() {
    const inProfile = currentScreen === 'profile' && !!auth?.currentUser;
    const canSwitchLocke = inProfile && getPlayerLockes(currentPlayer).length > 1;
    const signoutButton = document.getElementById('signout-button');
    const switchButton = document.getElementById('profile-locke-switch');
    signoutButton.classList.toggle('hidden', !inProfile);
    switchButton.classList.toggle('hidden', !canSwitchLocke);
    if(canSwitchLocke) {
        const nextLocke = currentLocke === 'PawPatrolOG' ? 'PawPatrolV2' : 'PawPatrolOG';
        switchButton.innerText = `🔁 CAMBIAR A ${nextLocke}`;
    }
}

function showAccountLink(user) {
    if(stopUserDataListener) stopUserDataListener();
    stopUserDataListener = null;
    currentPlayer = null;
    currentLocke = 'PawPatrolV2';
    currentAccountEmail = user.email || '';
    document.body.classList.remove('theme-og');
    document.body.classList.add('theme-v2');
    document.getElementById('locke-title').textContent = 'PAWPATROLV2';
    updateCoinDisplay();
    document.getElementById('auth-form').classList.add('hidden');
    document.getElementById('auth-link-form').classList.remove('hidden');
    setAuthMessage('Sesión iniciada. Completa la vinculación de tu entrenador.');
    showOnlyScreen('auth');
}

async function activateAccount(user, player) {
    if(!PLAYERS.includes(player)) {
        showAccountLink(user);
        return;
    }
    currentPlayer = player;
    currentAccountEmail = user.email || '';
    document.getElementById('auth-form').classList.remove('hidden');
    document.getElementById('auth-link-form').classList.add('hidden');
    updateCoinDisplay();
    if(getPlayerLockes(player).length > 1) {
        document.getElementById('locke-select-player').innerText = `PERFIL: ${player.toUpperCase()}`;
        showOnlyScreen('locke-select');
        return;
    }
    openLocke(getPlayerLockes(player)[0]);
}

async function openLocke(locke) {
    const allowedLockes = getPlayerLockes(currentPlayer);
    if(!currentPlayer || !allowedLockes.includes(locke)) return;
    gymTeamSelection = {};
    gymTeamSelectionLoaded = {};
    currentLocke = locke;
    document.getElementById('menu-map-action').classList.remove('hidden');
    document.getElementById('menu-map-button').querySelector('span').textContent =
        locke === 'PawPatrolOG' ? '🗺️ MAPA INTERACTIVO DE KALOS' : '🗺️ MAPA INTERACTIVO DE TESELIA';
    const mapTitle = document.getElementById('map-title');
    if(mapTitle) mapTitle.textContent = locke === 'PawPatrolOG' ? '🗺️ MAPA DE KALOS' : '🗺️ MAPA DE TESELIA';
    document.body.classList.toggle('theme-og', locke === 'PawPatrolOG');
    document.body.classList.toggle('theme-v2', locke === 'PawPatrolV2');
    document.getElementById('locke-title').textContent = locke.toUpperCase();
    document.getElementById('rules-table-og').classList.toggle('hidden', locke !== 'PawPatrolOG');
    document.getElementById('rules-table-v2').classList.toggle('hidden', locke !== 'PawPatrolV2');
    syncOgRouteAutocomplete();
    updateProfileActions();
    try {
        if(locke === 'PawPatrolV2') await migrateLegacyV2Data();
        if(currentLocke !== locke) return;
        subscribeToWorldData();
        window.nav('landing');
    } catch(error) {
        console.error(`Error preparando los datos de ${locke}:`, error);
        alert(`❌ No se pudieron preparar los datos de ${locke}: ${error.message}\nRevisa las reglas de acceso de Firebase e inténtalo de nuevo.`);
        if(getPlayerLockes(currentPlayer).length > 1) {
            document.getElementById('locke-select-player').innerText = `PERFIL: ${currentPlayer.toUpperCase()}`;
            showOnlyScreen('locke-select');
        } else {
            showOnlyScreen('auth');
            setAuthMessage(`No se pudieron cargar los datos de ${locke}: ${error.message}`, true);
        }
    }
}

window.selectLocke = function(locke) {
    if(currentScreen !== 'locke-select' || getPlayerLockes(currentPlayer).length < 2) return;
    openLocke(locke);
};
window.switchLocke = function() {
    if(currentScreen !== 'profile' || getPlayerLockes(currentPlayer).length < 2) return;
    openLocke(currentLocke === 'PawPatrolOG' ? 'PawPatrolV2' : 'PawPatrolOG');
};
window.logout = async function() {
    if(!auth) return;
    try {
        await signOut(auth);
    } catch(error) {
        console.error('Error al cerrar sesión:', error);
        alert(`❌ No se pudo cerrar sesión: ${error.message}`);
    }
};

async function playCaptureAnimation(species, nickname) {
    const overlay = document.getElementById('capture-animation');
    document.getElementById('capture-animation-name').textContent = `"${nickname}" · ${species}`;
    overlay.hidden = false;
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    await new Promise(resolve => setTimeout(resolve, reducedMotion ? 450 : 2000));
    overlay.hidden = true;
}

async function saveAccountProfile(user, player) {
    if(!PLAYERS.includes(player)) throw new Error('Selecciona un entrenador válido.');
    const claim = await runTransaction(ref(db, `cuentasEntrenadores/${player}`), existing => {
        if(existing && existing.uid !== user.uid) return;
        return { uid: user.uid, email: user.email || '' };
    }, { applyLocally: false });
    if(!claim.committed) throw new Error('Ese entrenador ya está vinculado a otra cuenta.');
    await set(ref(db, `cuentas/${user.uid}`), {
        jugador: player,
        email: user.email || '',
        creadoEn: Date.now()
    });
    await activateAccount(user, player);
}

async function handleLogin() {
    if(!auth || !db) return setAuthMessage('Firebase no está disponible. Comprueba la configuración e inténtalo de nuevo.', true);
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return setAuthMessage('Escribe tu correo y contraseña.', true);
    try {
        handlingAuthAction = true;
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const profile = await get(ref(db, `cuentas/${credential.user.uid}`));
        if(profile.exists() && PLAYERS.includes(profile.val().jugador)) {
            const claim = await runTransaction(ref(db, `cuentasEntrenadores/${profile.val().jugador}`), existing => {
                if(existing && existing.uid !== credential.user.uid) return;
                return { uid: credential.user.uid, email: credential.user.email || '' };
            }, { applyLocally: false });
            if(!claim.committed) throw new Error('Ese entrenador ya está vinculado a otra cuenta.');
            await activateAccount(credential.user, profile.val().jugador);
        } else {
            showAccountLink(credential.user);
        }
        setAuthMessage('');
    } catch(error) {
        console.error('Error al iniciar sesión:', error);
        setAuthMessage(authErrorMessage(error), true);
    } finally {
        handlingAuthAction = false;
    }
}

async function handleRegistration() {
    if(!auth || !db) return setAuthMessage('Firebase no está disponible. Comprueba la configuración e inténtalo de nuevo.', true);
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const player = document.getElementById('register-player').value;
    if(!email || !password || !player) return setAuthMessage('Completa el correo, la contraseña y el entrenador.', true);
    try {
        handlingAuthAction = true;
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        try {
            await saveAccountProfile(credential.user, player);
            setAuthMessage('');
        } catch(error) {
            console.error('La cuenta se creó, pero no se pudo guardar su perfil:', error);
            showAccountLink(credential.user);
            setAuthMessage(`La cuenta se creó, pero falta guardar el entrenador: ${error.message}`, true);
        }
    } catch(error) {
        console.error('Error al registrar la cuenta:', error);
        setAuthMessage(authErrorMessage(error), true);
    } finally {
        handlingAuthAction = false;
    }
}

function authErrorMessage(error) {
    const messages = {
        'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Inicia sesión.',
        'auth/invalid-email': 'El formato del correo no es válido.',
        'auth/invalid-credential': 'Correo o contraseña incorrectos.',
        'auth/user-not-found': 'No existe una cuenta con ese correo.',
        'auth/wrong-password': 'La contraseña es incorrecta.',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
        'auth/too-many-requests': 'Demasiados intentos. Espera un momento y vuelve a probar.',
        'auth/network-request-failed': 'No hay conexión. Comprueba internet e inténtalo de nuevo.',
        'database/permission-denied': 'Firebase denegó el acceso a la base de datos. Revisa sus reglas.'
    };
    return messages[error.code] || `No se pudo completar la operación: ${error.message || 'error desconocido'}`;
}

document.getElementById('login-button').addEventListener('click', handleLogin);
document.getElementById('register-button').addEventListener('click', handleRegistration);
document.getElementById('auth-form').addEventListener('submit', event => { event.preventDefault(); handleLogin(); });
document.getElementById('link-account-button').addEventListener('click', async () => {
    const user = auth && auth.currentUser;
    const player = document.getElementById('link-player').value;
    if(!user || !player) return setAuthMessage('Selecciona el entrenador que quieres vincular.', true);
    try {
        handlingAuthAction = true;
        await saveAccountProfile(user, player);
        setAuthMessage('');
    } catch(error) {
        console.error('Error al vincular el entrenador:', error);
        setAuthMessage(authErrorMessage(error), true);
    } finally {
        handlingAuthAction = false;
    }
});

window.nav = function(targetScreen) {
    if(!auth || !auth.currentUser || (!getMyPlayer() && targetScreen !== 'profile')) {
        if(targetScreen !== 'auth') showOnlyScreen('auth');
        return;
    }
    if (['add', 'capture-select', 'capture-failed', 'teambuilder', 'badges', 'gacha', 'collectibles', 'revive', 'ban-select', 'repel'].includes(targetScreen) && !getMyPlayer()) {
        alert("⚠️ Primero debes iniciar sesión y vincular un entrenador."); return showOnlyScreen('auth');
    }
    if(targetScreen === 'ban-select') selectedBanPlayer = '';
    transitionToScreen(targetScreen);
    if(targetScreen === 'add') document.getElementById('playerInput').value = getMyPlayer();
    if(targetScreen === 'capture-failed') document.getElementById('failedPlayerInput').value = getMyPlayer();
    refreshCurrentScreen();
};

function refreshCurrentScreen() {
    updateCoinDisplay();
    if(currentScreen === 'view') {
        renderGroupedList(globalData.filter(c => c.estado === 'Vivo'), 'grid-view', true);
        renderGroupedList(globalData.filter(c => c.estado === 'Baneado'), 'grid-view-banned', true);
        renderRepelentes();
    }
    if(currentScreen === 'cemetery') renderGroupedList(globalData.filter(c => c.estado === 'Muerto'), 'grid-cemetery', true);
    if(currentScreen === 'ranking') renderRanking();
    if(currentScreen === 'profile') window.updateProfileView();
    if(currentScreen === 'teambuilder') window.updateTeambuilderView();
    if(currentScreen === 'badges') window.updateBadgesView();
    if(currentScreen === 'map') window.updateKalosMap();
    if(currentScreen === 'collectibles') window.switchInvTab('skins');
    if(currentScreen === 'revive') window.updateReviveSelectionView();
    if(currentScreen === 'ban-select') window.updateBanSelectionView();
    if(currentScreen === 'gacha') updateDailyTimer();
    if(currentScreen === 'add') {
        const p = getMyPlayer();
        const playerFailedRoutes = globalFailedRoutes[p] || [];
        if(playerFailedRoutes.length > 0) {
            document.getElementById('routeInput').placeholder = `Rutas ya usadas: ${playerFailedRoutes.join(', ')}`;
        }
    }
}

function updateCoinDisplay() {
    const p = getMyPlayer(); const disp = document.getElementById('pawcoin-display');
    if(p) { disp.classList.remove('hidden'); document.getElementById('pawcoin-amount').innerText = globalEco[p] || 0; }
    else { disp.classList.add('hidden'); }
}

function updateTeamWeaknessSummary(team) {
    const content = document.getElementById('team-weakness-content');
    const requestId = ++teamWeaknessRequestId;
    if(!team.length) {
        content.textContent = 'Añade Pokémon para calcular sus debilidades.';
        return;
    }
    content.textContent = 'Calculando debilidades...';
    Promise.all(team.map(async pokemon => {
        try {
            return { pokemon, types: await getPokemonTypeData(pokemon.especie) };
        } catch(error) {
            console.warn(`No se pudieron consultar los tipos de ${pokemon.especie}:`, error);
            return { pokemon, types: null };
        }
    })).then(results => {
        if(requestId !== teamWeaknessRequestId) return;
        const available = results.filter(result => result.types);
        if(!available.length) {
            content.textContent = 'No se pudieron cargar los tipos. Comprueba la conexión e inténtalo de nuevo.';
            return;
        }
        const weaknessCounts = {};
        Object.keys(POKEMON_TYPE_CHART).forEach(attackType => {
            const count = available.filter(({ types }) =>
                getTypeEffectivenessMultiplier(attackType, types) >= 2).length;
            if(count) weaknessCounts[attackType] = count;
        });
        const threshold = Math.max(1, Math.ceil(available.length / 3));
        const weaknesses = Object.entries(weaknessCounts)
            .filter(([, count]) => count >= threshold)
            .sort((a, b) => b[1] - a[1] || POKEMON_TYPE_NAMES[a[0]].localeCompare(POKEMON_TYPE_NAMES[b[0]], 'es'))
            .slice(0, 6);
        content.replaceChildren();
        if(weaknesses.length) {
            const list = document.createElement('div');
            list.className = 'flex flex-wrap justify-center gap-2';
            weaknesses.forEach(([type, count]) => {
                const badge = document.createElement('span');
                badge.className = 'rounded-full px-3 py-1 text-sm font-black text-white shadow';
                badge.style.backgroundColor = POKEMON_TYPE_COLORS[type];
                if(type === 'electric') badge.style.color = '#422006';
                badge.textContent = `${POKEMON_TYPE_NAMES[type]} · ${count}/${available.length}`;
                list.appendChild(badge);
            });
            content.appendChild(list);
            const note = document.createElement('p');
            note.className = 'mt-2 text-xs text-gray-500';
            note.textContent = 'Tipos que afectan con daño x2 o más a, al menos, un tercio del equipo.';
            content.appendChild(note);
        } else {
            content.textContent = 'No se detectan debilidades de tipo x2 o superior en el equipo.';
        }
        if(available.length < team.length) {
            const note = document.createElement('p');
            note.className = 'mt-2 text-xs text-amber-700';
            note.textContent = `Tipos cargados para ${available.length} de ${team.length} Pokémon.`;
            content.appendChild(note);
        }
    });
}

function cancelTeamAutocomplete() {
    teamAutocompleteRequestId++;
    const button = document.getElementById('team-autocomplete-button');
    if(button) button.disabled = false;
    const status = document.getElementById('team-autocomplete-status');
    if(status) status.textContent = '';
}

window.autoCompleteGymTeam = async function() {
    const gymSelector = document.getElementById('teambuilder-gym-selector');
    const button = document.getElementById('team-autocomplete-button');
    const status = document.getElementById('team-autocomplete-status');
    const gymNumber = gymSelector.value;
    const player = getMyPlayer();
    if(!player) {
        status.textContent = 'Inicia sesión para recomendar un equipo.';
        return;
    }

    const requestId = ++teamAutocompleteRequestId;
    button.disabled = true;
    status.textContent = 'Consultando los tipos de los Pokémon disponibles...';
    try {
        const eligiblePokemon = getEligibleTeamPokemon(player, gymNumber);
        if(!eligiblePokemon.length) {
            status.textContent = 'No hay Pokémon disponibles para este gimnasio.';
            return;
        }

        const selectedIds = [...new Set(gymTeamSelection[gymNumber] || [])];
        const missingSlots = Math.max(0, 6 - selectedIds.length);
        if(!missingSlots) {
            status.textContent = 'El equipo ya tiene seis Pokémon; se conserva la selección actual.';
            return;
        }

        const typeResults = await Promise.all(eligiblePokemon.map(async pokemon => {
            try {
                return { pokemon, types: await getPokemonTypeData(pokemon.especie) };
            } catch(error) {
                console.warn(`No se pudieron consultar los tipos de ${pokemon.especie}:`, error);
                return { pokemon, types: null };
            }
        }));
        if(requestId !== teamAutocompleteRequestId) return;
        if(gymSelector.value !== gymNumber) {
            status.textContent = 'Cambió el gimnasio durante el cálculo; no se aplicó la propuesta.';
            return;
        }

        const selectedIdSet = new Set(selectedIds);
        const typeResultsById = new Map(typeResults.map(result => [result.pokemon.id, result]));
        const fixedTeam = selectedIds.map(id => {
            const selectedPokemon = typeResultsById.get(id);
            return {
                ...(selectedPokemon?.pokemon || { id }),
                types: selectedPokemon?.types || []
            };
        });
        const failedSelectedTypeCount = selectedIds.filter(id =>
            !typeResultsById.get(id)?.types?.length
        ).length;
        const candidates = typeResults
            .filter(result => !selectedIdSet.has(result.pokemon.id) && result.types?.length)
            .map(result => ({ ...result.pokemon, types: result.types }));
        const failedCandidateTypeCount = typeResults.filter(result =>
            !selectedIdSet.has(result.pokemon.id) && !result.types?.length
        ).length;
        if(!candidates.length) {
            status.textContent = failedCandidateTypeCount
                ? 'No se pudieron cargar los tipos de los candidatos adicionales. Se conserva tu selección.'
                : 'No hay Pokémon adicionales disponibles para completar el equipo.';
            return;
        }

        const recommendedTeam = recommendTeamByTypes(candidates, 6, fixedTeam);
        gymTeamSelection[gymNumber] = recommendedTeam.map(pokemon => pokemon.id);
        window.updateTeambuilderView();
        const addedCount = recommendedTeam.length - selectedIds.length;
        const partialResult = failedCandidateTypeCount
            ? ` Se omitieron ${failedCandidateTypeCount} candidatos cuyos tipos no se pudieron consultar.`
            : '';
        const incompleteTypeResult = failedSelectedTypeCount
            ? ` No se pudieron consultar los tipos de ${failedSelectedTypeCount} Pokémon ya seleccionados, así que la recomendación es menos precisa.`
            : '';
        status.textContent = `Se conservaron ${selectedIds.length} seleccionados y se añadieron ${addedCount} Pokémon para completar el equipo. Revísalo y pulsa «Guardar Equipo» para conservarlo.${partialResult}${incompleteTypeResult}`;
    } catch(error) {
        console.error('Error al recomendar un equipo por tipos:', error);
        status.textContent = 'No se pudo calcular la propuesta. Comprueba la conexión e inténtalo de nuevo.';
    } finally {
        if(requestId === teamAutocompleteRequestId) button.disabled = false;
    }
};

function subscribeToWorldData() {
    if(!db || !auth || !auth.currentUser || !currentPlayer) return;
    if(stopUserDataListener) stopUserDataListener();
    const subscribedPlayer = currentPlayer;
    globalData = []; globalBadges = {}; rankingData = {}; globalEco = {}; globalInv = {}; globalActivos = {}; globalRepelentes = []; globalFailedRoutes = {}; globalEquiposGimnasio = {};
    updateCoinDisplay();
    stopUserDataListener = onValue(ref(db, getUsersPath()), (snapshot) => {
        const data = snapshot.val() || {};
        globalData = []; globalBadges = {}; rankingData = {}; globalEco = {}; globalInv = {}; globalActivos = {}; globalRepelentes = []; globalFailedRoutes = {}; globalEquiposGimnasio = {};

        const routeUpdates = {};
        const addPokemonRecords = (player, collection, collectionName, state) => {
            Object.keys(collection).forEach(id => {
                const pokemon = collection[id];
                const normalizedRoute = currentLocke === 'PawPatrolV2'
                    ? canonicalizeV2PokemonRoute(pokemon.ruta || '', normalizeRouteKeyword)
                    : pokemon.ruta;
                if(player === subscribedPlayer && currentLocke === 'PawPatrolV2' &&
                    typeof pokemon.ruta === 'string' && normalizedRoute !== pokemon.ruta) {
                    routeUpdates[`${collectionName}/${id}/ruta`] = normalizedRoute;
                }
                globalData.push({
                    id,
                    jugador: player,
                    estado: state,
                    ...pokemon,
                    ruta: normalizedRoute
                });
            });
        };

        (LOCKE_PLAYERS[currentLocke] || []).forEach(player => {
            const pData = data[player] || {};
            rankingData[player] = { victorias: pData.ranking?.victorias || 0, derrotas: pData.ranking?.derrotas || 0 };
            globalBadges[player] = pData.medallas || {};
            globalEco[player] = pData.economia?.puntos || 0;
            globalInv[player] = pData.inventario || { skins: [], banners: [], consumibles: {} };
            globalEquiposGimnasio[player] = pData.equipos || {};
            globalActivos[player] = pData.activos || { skin: '', banner: 'bg-gray-800' };
            const failedRoutes = pData.rutasFallidas || [];
            globalFailedRoutes[player] = currentLocke === 'PawPatrolV2'
                ? failedRoutes.map(route => canonicalizeV2PokemonRoute(route, normalizeRouteKeyword))
                : failedRoutes;

            if (pData.pokemon) {
                if (pData.pokemon.vivos) addPokemonRecords(player, pData.pokemon.vivos, 'vivos', 'Vivo');
                if (pData.pokemon.muertos) addPokemonRecords(player, pData.pokemon.muertos, 'muertos', 'Muerto');
                if (pData.pokemon.baneados) addPokemonRecords(player, pData.pokemon.baneados, 'baneados', 'Baneado');
            }
            if (pData.repelentes) Object.values(pData.repelentes).forEach(record => globalRepelentes.push({ ...record, jugador: player }));
        });
        if(Object.keys(routeUpdates).length) {
            update(ref(db, userPath(`${subscribedPlayer}/pokemon`)), routeUpdates).catch(error => {
                console.error('No se pudieron guardar los nombres de ruta normalizados:', error);
                alert('⚠️ Las rutas antiguas se muestran con sus nombres actuales, pero no se pudieron guardar los cambios en Firebase.');
            });
        }
        globalData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        refreshCurrentScreen();
    }, (error) => {
        console.error('Error leyendo datos del Locke:', error);
        document.getElementById('connectionStatus').innerText = '❌ ERROR DE DATOS';
        alert(`❌ No se pudieron cargar los datos de ${currentLocke}: ${error.message}`);
    });

    if(stopSuggestionsListener) stopSuggestionsListener();
    stopSuggestionsListener = onValue(ref(db, lockePath('sugerencias')), (snapshot) => {
        const data = snapshot.val(); let html = '';
        if(data) { Object.values(data).sort((a,b)=>b.timestamp-a.timestamp).forEach(s => { html += `<div class="cartoon-panel p-4 border-2 border-gray-300"><p class="font-bold text-pink-600 mb-1">👤 ${s.jugador} <span class="text-xs text-gray-400">(${new Date(s.timestamp).toLocaleDateString()})</span></p><p class="text-gray-700">${s.texto}</p></div>`; }); }
        document.getElementById('grid-suggestions').innerHTML = html;
    }, (error) => {
        console.error('Error leyendo sugerencias:', error);
    });
}

// --- CONEXIÓN FIREBASE ---
if (firebaseConfig.apiKey) {
    try {
        console.log("Iniciando Firebase...");
        initializeApp(firebaseConfig);
        db = getDatabase();
        auth = getAuth();
        console.log("Firebase inicializado correctamente");
        document.getElementById('connectionStatus').innerHTML = "✅ ONLINE";
        document.getElementById('connectionStatus').className = "text-xs font-bold px-4 py-2 bg-slate-950/90 text-green-300 border border-green-500 rounded-full shadow-lg";

        onAuthStateChanged(auth, async (user) => {
            if(handlingAuthAction) return;
            if(!user) {
                if(stopUserDataListener) stopUserDataListener();
                if(stopSuggestionsListener) stopSuggestionsListener();
                stopUserDataListener = null; stopSuggestionsListener = null;
                currentPlayer = null; currentAccountEmail = ''; currentLocke = 'PawPatrolV2';
                document.body.classList.remove('theme-og');
                document.body.classList.add('theme-v2');
                document.getElementById('locke-title').textContent = 'PAWPATROLV2';
                document.getElementById('auth-form').classList.remove('hidden');
                document.getElementById('auth-link-form').classList.add('hidden');
                setAuthMessage('');
                updateCoinDisplay();
                showOnlyScreen('auth');
                return;
            }
            try {
                currentAccountEmail = user.email || '';
                const profile = await get(ref(db, `cuentas/${user.uid}`));
                if(!auth.currentUser || auth.currentUser.uid !== user.uid) return;
                if(profile.exists() && PLAYERS.includes(profile.val().jugador)) {
                    const claim = await runTransaction(ref(db, `cuentasEntrenadores/${profile.val().jugador}`), existing => {
                        if(existing && existing.uid !== user.uid) return;
                        return { uid: user.uid, email: user.email || '' };
                    }, { applyLocally: false });
                    if(!claim.committed) throw new Error('Ese entrenador ya está vinculado a otra cuenta.');
                    await activateAccount(user, profile.val().jugador);
                } else {
                    showAccountLink(user);
                }
            } catch(error) {
                console.error('Error cargando el perfil de la cuenta:', error);
                showOnlyScreen('auth');
                setAuthMessage(authErrorMessage(error), true);
            }
        });
    } catch (error) {
        console.error("Error conectando a Firebase:", error);
        document.getElementById('connectionStatus').innerHTML = "❌ ERROR FIREBASE";
        document.getElementById('connectionStatus').className = "text-xs font-bold px-4 py-2 bg-slate-950/90 text-red-300 border border-red-500 rounded-full shadow-lg";
    }
}

document.getElementById('suggestionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = document.getElementById('suggestionInput').value.trim();
    if(!text || !db || !getMyPlayer()) return alert('Inicia sesión para enviar una sugerencia.');
    try {
        await push(ref(db, lockePath('sugerencias')), { jugador: getMyPlayer(), texto: text, timestamp: Date.now() });
        document.getElementById('suggestionInput').value = '';
        alert('¡Enviada!');
    } catch(error) {
        console.error('Error al enviar sugerencia:', error);
        alert(`❌ No se pudo enviar la sugerencia: ${error.message}`);
    }
});
window.filterCards = function(query, containerId) { const term = query.toLowerCase(); document.getElementById(containerId).querySelectorAll('.poke-card').forEach(card => card.style.display = card.getAttribute('data-search').toLowerCase().includes(term) ? 'flex' : 'none'); };

// --- SISTEMA DE GACHA 🎰 ---
window.pullGacha = function() {
    const p = getMyPlayer(); const currentPts = globalEco[p] || 0;
    if(currentPts < 50) return alert("❌ No tienes suficientes PawCoins. ¡Captura Pokémon o gana medallas!");

    const btn = document.getElementById('btn-pull-gacha'); const icon = document.getElementById('gacha-icon');
    const resDiv = document.getElementById('gacha-result'); const machine = document.getElementById('gacha-machine');
    btn.disabled = true; resDiv.classList.add('hidden'); machine.classList.add('shake-animation'); icon.innerHTML = '🔮';

    setTimeout(() => {
        machine.classList.remove('shake-animation'); icon.innerHTML = '🎁';
        const r = Math.random() * 100;
        let type, id, name, desc, imgUrl = ''; let extraCoins = 0;

        if (r < 1) { type = 'consumible'; id = 'revivir'; name = G_CONSUMABLES[id].name; desc = "Mítico (1%). Ve al inventario para usarlo."; imgUrl = `https://play.pokemonshowdown.com/sprites/itemicons/${G_CONSUMABLES[id].icon}.png`; }
        else if (r < 2) { type = 'consumible'; id = 'ban'; name = G_CONSUMABLES[id].name; desc = "Mítico (1%). Jode a un rival."; imgUrl = `https://play.pokemonshowdown.com/sprites/itemicons/${G_CONSUMABLES[id].icon}.png`; }
        else if (r < 3) { type = 'consumible'; id = 'skip'; name = G_CONSUMABLES[id].name; desc = "Mítico (1%). Sáltate tu primer Pokémon de ruta."; imgUrl = `https://play.pokemonshowdown.com/sprites/itemicons/${G_CONSUMABLES[id].icon}.png`; }
        else if (r < 30) { type = 'skin'; id = G_SKINS[Math.floor(Math.random()*G_SKINS.length)]; name = `Skin: ${id.toUpperCase()}`; desc = "Cosmético Raro (27%)"; imgUrl = `https://play.pokemonshowdown.com/sprites/trainers/${getSkinSpriteId(id)}.png`; }
        else if (r < 60) { type = 'banner'; id = G_BANNERS[Math.floor(Math.random()*G_BANNERS.length)]; name = `Banner ${getBannerName(id)}`; desc = "Cosmético Común (30%)"; }
        else { type = 'pepita'; name = "Pepita"; desc = "¡Consolación! (40%). Te devuelven 25 🪙"; imgUrl = `https://play.pokemonshowdown.com/sprites/itemicons/nugget.png`; extraCoins = 25; }

        if (db) {
            const refInv = userPath(`${p}/inventario`);
            if (type === 'skin') { let arr = globalInv[p].skins || []; if(!arr.includes(id)) { arr.push(id); update(ref(db, refInv), { skins: arr }); } else { desc += " (Repetido: compensación +10 🪙)"; extraCoins = 10; } }
            else if (type === 'banner') { let arr = globalInv[p].banners || []; if(!arr.includes(id)) { arr.push(id); update(ref(db, refInv), { banners: arr }); } else { desc += " (Repetido: compensación +10 🪙)"; extraCoins = 10; } }
            else if (type === 'consumible') { let cons = globalInv[p].consumibles || {}; cons[id] = (cons[id]||0) + 1; update(ref(db, refInv), { consumibles: cons }); }
            update(ref(db, userPath(`${p}/economia`)), { puntos: currentPts - 50 + extraCoins });
        }

        document.getElementById('gacha-result-name').innerText = name; document.getElementById('gacha-result-desc').innerText = desc;
        const imgEl = document.getElementById('gacha-result-img');
        if(imgUrl) { imgEl.src = imgUrl; imgEl.classList.remove('hidden'); } else { imgEl.classList.add('hidden'); }
        resDiv.classList.remove('hidden'); btn.disabled = false;
    }, 1000);
}

window.pullDailyGacha = function() {
    const p = getMyPlayer();
    const lastDaily = localStorage.getItem(dailyGachaKey(p));
    const now = new Date();
    const today = now.toDateString();

    if (lastDaily === today) {
        return alert("❌ Ya has usado tu tirada diaria gratuita hoy. ¡Vuelve mañana!");
    }

    const btn = document.getElementById('btn-daily-gacha'); const icon = document.getElementById('gacha-icon');
    const resDiv = document.getElementById('gacha-result'); const machine = document.getElementById('gacha-machine');
    btn.disabled = true; resDiv.classList.add('hidden'); machine.classList.add('shake-animation'); icon.innerHTML = '🔮';

    setTimeout(() => {
        machine.classList.remove('shake-animation'); icon.innerHTML = '🎁';
        const r = Math.random() * 100;
        let type, id, name, desc, imgUrl = '';

        if (r < 50) {
            type = 'skin';
            id = G_SKINS[Math.floor(Math.random()*G_SKINS.length)];
            name = `Skin: ${id.toUpperCase()}`;
            desc = "Cosmético Raro (50%)";
            imgUrl = `https://play.pokemonshowdown.com/sprites/trainers/${getSkinSpriteId(id)}.png`;
        } else {
            type = 'banner';
            id = G_BANNERS[Math.floor(Math.random()*G_BANNERS.length)];
            name = `Banner ${getBannerName(id)}`;
            desc = "Cosmético Común (50%)";
        }

        if (db) {
            const refInv = userPath(`${p}/inventario`);
            if (type === 'skin') {
                let arr = globalInv[p].skins || [];
                if(!arr.includes(id)) {
                    arr.push(id);
                    update(ref(db, refInv), { skins: arr });
                } else {
                    desc += " (Repetido: compensación +10 🪙)";
                    update(ref(db, userPath(`${p}/economia`)), { puntos: (globalEco[p] || 0) + 10 });
                }
            } else if (type === 'banner') {
                let arr = globalInv[p].banners || [];
                if(!arr.includes(id)) {
                    arr.push(id);
                    update(ref(db, refInv), { banners: arr });
                } else {
                    desc += " (Repetido: compensación +10 🪙)";
                    update(ref(db, userPath(`${p}/economia`)), { puntos: (globalEco[p] || 0) + 10 });
                }
            }
            localStorage.setItem(dailyGachaKey(p), today);
            writeLog(p, `Usó tirada diaria gratuita: ${name}`);
        }

        document.getElementById('gacha-result-name').innerText = name;
        document.getElementById('gacha-result-desc').innerText = desc;
        const imgEl = document.getElementById('gacha-result-img');
        if(imgUrl) { imgEl.src = imgUrl; imgEl.classList.remove('hidden'); } else { imgEl.classList.add('hidden'); }
        resDiv.classList.remove('hidden');
        btn.disabled = false;
        updateDailyTimer();
    }, 1000);
}

function updateDailyTimer() {
    const p = getMyPlayer();
    const timerEl = document.getElementById('daily-timer');
    if (!p || !timerEl) return;

    const lastDaily = localStorage.getItem(dailyGachaKey(p));
    const now = new Date();
    const today = now.toDateString();

    if (lastDaily === today) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const diff = tomorrow - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        timerEl.innerText = `⏰ Siguiente tirada en: ${hours}h ${minutes}m`;
        timerEl.classList.remove('hidden');
    } else {
        timerEl.innerText = "✅ ¡Tirada diaria disponible!";
        timerEl.classList.remove('hidden');
    }
}

// --- SISTEMA DE INVENTARIO ---
window.switchInvTab = function(tab) {
    document.getElementById('inv-skins').classList.add('hidden'); document.getElementById('inv-banners').classList.add('hidden'); document.getElementById('inv-consumables').classList.add('hidden');
    document.getElementById('inv-' + tab).classList.remove('hidden');
    if(tab === 'skins') document.getElementById('inv-' + tab).classList.add('grid');
    if(tab === 'consumables') document.getElementById('inv-' + tab).classList.add('grid');
    if(tab === 'banners') document.getElementById('inv-' + tab).classList.add('flex');

    const p = getMyPlayer(); const inv = globalInv[p]; const acts = globalActivos[p];
    if(tab === 'skins') {
        const sArr = inv.skins || [];
        if(sArr.length === 0) document.getElementById('inv-skins').innerHTML = '<p class="col-span-full font-bold text-gray-500 text-center mt-10">No tienes skins. ¡Tira en el Gacha!</p>';
        else document.getElementById('inv-skins').innerHTML = sArr.map(s => `<div class="cartoon-panel flex flex-col items-center p-4 bg-white ${acts.skin === s ? 'border-green-500' : ''}"><img src="https://play.pokemonshowdown.com/sprites/trainers/${getSkinSpriteId(s)}.png" class="h-20 pixel-art mb-4"><button onclick="window.equipItem('skin', '${s}')" class="cartoon-btn-sm ${acts.skin === s ? 'bg-green-200 text-green-800' : 'bg-blue-100 text-blue-800'}">${acts.skin === s ? 'Equipado' : 'Equipar'}</button></div>`).join('');
    }
    if(tab === 'banners') {
        const bArr = inv.banners || [];
        if(bArr.length === 0) document.getElementById('inv-banners').innerHTML = '<p class="col-span-full font-bold text-gray-500 text-center mt-10">No tienes banners. ¡Tira en el Gacha!</p>';
        else document.getElementById('inv-banners').innerHTML = bArr.map(b => `<div class="player-banner ${b} p-4 text-center text-xl font-bold flex justify-between items-center ${acts.banner === b ? 'border-green-500 border-8' : ''}"><span class="banner-name ml-4 uppercase">${getBannerName(b)}</span><button onclick="window.equipItem('banner', '${b}')" class="cartoon-btn-sm bg-white text-black text-sm">${acts.banner === b ? 'Equipado' : 'Equipar'}</button></div>`).join('');
    }
    if(tab === 'consumables') {
        const cObj = inv.consumibles || {}; let html = '';
        Object.keys(G_CONSUMABLES).forEach(id => {
            const count = cObj[id] || 0;
            html += `<div class="cartoon-panel flex flex-col items-center p-4 ${count > 0 ? 'bg-yellow-50 border-yellow-500' : 'grayscale-dead'}"><img src="https://play.pokemonshowdown.com/sprites/itemicons/${G_CONSUMABLES[id].icon}.png" class="h-12 pixel-art mb-2"><p class="font-bold text-center mb-2">${G_CONSUMABLES[id].name}</p><p class="text-2xl title-font mb-4 text-gray-600">x${count}</p><button onclick="window.useConsumable('${id}', ${count})" ${count === 0 ? 'disabled' : ''} class="cartoon-btn-sm bg-red-100 text-red-800 w-full">Usar</button></div>`;
        });
        document.getElementById('inv-consumables').innerHTML = html;
    }
}

window.equipItem = function(type, id) {
    if(!db) return; update(ref(db, userPath(`${getMyPlayer()}/activos`)), { [type]: id });
    setTimeout(() => window.switchInvTab(type+'s'), 200);
}

window.useConsumable = function(id, count) {
    if(count <= 0) return;
    if(id === 'revivir') return window.nav('revive');
    if(id === 'ban') return window.nav('ban-select');
    if(id === 'skip') return window.nav('repel');
    if(confirm(`⚠️ ¿Seguro que quieres gastar este objeto? No se puede deshacer.`)) {
        if(db) {
            const p = getMyPlayer(); update(ref(db, userPath(`${p}/inventario/consumibles`)), { [id]: count - 1 });
            writeLog(p, `Ha utilizado el consumible mítico: ${G_CONSUMABLES[id].name}`);
            alert(`✅ Has usado ${G_CONSUMABLES[id].name}. ¡Aplica el efecto en el juego!`);
            window.switchInvTab('consumables');
        }
    }
}

document.getElementById('repelForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const player = getMyPlayer();
    const enteredRoute = document.getElementById('repel-route').value.trim();
    const ruta = getCanonicalRouteEntry(enteredRoute);
    const pokemonIgnorado = document.getElementById('repel-skipped').value.trim();
    const pokemonCapturado = document.getElementById('repel-captured').value.trim();
    if(!player || !pokemonIgnorado || !pokemonCapturado || !db) return;
    if(currentLocke === 'PawPatrolV2' && !isValidRouteEntry(enteredRoute)) {
        return alert('❌ Selecciona una ruta o zona válida de la lista de autocompletado.');
    }

    const recordKey = push(ref(db, userPath(`${player}/repelentes`))).key;
    const timestamp = Date.now();
    try {
        const result = await runTransaction(ref(db, userPath(player)), (user) => {
            const consumables = user && user.inventario && user.inventario.consumibles;
            if(!user || !consumables || (consumables.skip || 0) < 1) return;
            user.repelentes = user.repelentes || {};
            user.repelentes[recordKey] = { ruta, pokemonIgnorado, pokemonCapturado, timestamp };
            consumables.skip -= 1;
            return user;
        }, { applyLocally: false });

        if(!result.committed) return alert('No se pudo registrar: comprueba que aún tienes un Repelente Máximo.');
        globalRepelentes.push({ ruta, pokemonIgnorado, pokemonCapturado, timestamp, jugador: player });
        writeLog(player, `Usó Repelente Máximo en ${ruta}: ignoró ${pokemonIgnorado} y capturó ${pokemonCapturado}`);
        document.getElementById('repelForm').reset();
        alert('🌀 Uso registrado públicamente. El Repelente Máximo se ha consumido.');
        window.nav('view');
    } catch(error) {
        alert('❌ No se pudo registrar el Repelente Máximo. Comprueba la conexión e inténtalo de nuevo.');
    }
});

window.updateReviveSelectionView = function() {
    const p = getMyPlayer();
    const container = document.getElementById('grid-revive-selection');
    const deadPokemon = globalData.filter(data => data.jugador === p && data.estado === 'Muerto');
    if(deadPokemon.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center font-bold text-gray-500 p-8">No tienes Pokémon en el cementerio.</div>';
        return;
    }
    container.innerHTML = deadPokemon.map(data => `
        <div class="cartoon-panel flex flex-col items-center text-center p-4 bg-white border-emerald-300">
            <h3 class="font-bold text-lg uppercase truncate w-full mb-1">"${data.mote}"</h3>
            <p class="text-sm font-bold text-gray-500 mb-2">${data.especie}</p>
            <img data-species-name="${data.especie}" data-shiny="${!!data.shiny}" src="${getPokemonSpriteUrl(data, true)}" class="pixel-art grayscale h-16 mb-3" onerror="window.pokemonSpriteFallback(this);">
            <p class="text-xs text-gray-400 font-bold mb-3">📍 ${data.ruta}</p>
            <button onclick="window.revivePokemon('${data.id}')" class="cartoon-btn-sm bg-emerald-200 border-emerald-700 text-emerald-900 w-full">💚 REVIVIR</button>
        </div>`).join('');
}

window.revivePokemon = async function(id) {
    const player = getMyPlayer();
    if(!player || !db) return;
    if(!confirm('¿Usar Revivir Máximo en este Pokémon?')) return;

    try {
        const result = await runTransaction(ref(db, userPath()), (users) => {
            const user = users && users[player];
            const consumables = user && user.inventario && user.inventario.consumibles;
            const deadPokemon = user && user.pokemon && user.pokemon.muertos && user.pokemon.muertos[id];
            if(!deadPokemon || !consumables || (consumables.revivir || 0) < 1) return;

            user.pokemon.vivos = user.pokemon.vivos || {};
            user.pokemon.vivos[id] = { ...deadPokemon, inTeam: false, revividoPor: player, revividoEn: Date.now() };
            delete user.pokemon.muertos[id];
            consumables.revivir -= 1;
            return users;
        }, { applyLocally: false });

        if(!result.committed) return alert('No se pudo revivir: revisa que el Pokémon siga en el cementerio y que aún tengas el objeto.');
        const revived = globalData.find(data => data.id === id && data.jugador === player);
        writeLog(player, `Ha revivido a ${revived ? revived.mote : 'un Pokémon'} con Revivir Máximo`);
        alert('💚 ¡Pokémon revivido! Ahora está en tu Mochila.');
        window.nav('collectibles');
    } catch(error) {
        alert('❌ No se pudo completar la resurrección. Comprueba la conexión e inténtalo de nuevo.');
    }
}

window.updateBanSelectionView = function() {
    const player = getMyPlayer();
    const heading = document.getElementById('ban-selection-heading');
    const container = document.getElementById('grid-ban-selection');

    if(!selectedBanPlayer) {
        heading.innerText = 'PASO 1 · Elige a un rival';
        const rivals = PLAYERS.filter(name => name !== player);
        container.innerHTML = rivals.map(rival => {
            const count = globalData.filter(data => data.jugador === rival && data.estado === 'Vivo').length;
            return `<button onclick="window.selectBanPlayer('${rival}')" ${count === 0 ? 'disabled' : ''} class="cartoon-panel p-5 text-center bg-white border-red-300 hover:border-red-600 disabled:opacity-50 disabled:cursor-not-allowed">
                <span class="text-4xl block mb-2">🎯</span><span class="title-font text-2xl text-gray-800 block">${rival}</span>
                <span class="text-sm font-bold text-gray-500">${count} Pokémon disponibles</span>
            </button>`;
        }).join('');
        return;
    }

    heading.innerHTML = `<button onclick="window.backToBanPlayers()" class="cartoon-btn-sm mb-3">⬅ CAMBIAR JUGADOR</button><p>PASO 2 · Elige qué Pokémon de ${selectedBanPlayer} quedará baneado</p>`;
    const targetPokemon = globalData.filter(data => data.jugador === selectedBanPlayer && data.estado === 'Vivo');
    if(targetPokemon.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center font-bold text-gray-500 p-8">Este jugador no tiene Pokémon disponibles para banear.</div>';
        return;
    }
    container.innerHTML = targetPokemon.map(data => `
        <div class="cartoon-panel flex flex-col items-center text-center p-4 bg-white border-red-300">
            <h3 class="font-bold text-lg uppercase truncate w-full mb-1">"${data.mote}"</h3>
            <p class="text-sm font-bold text-gray-500 mb-2">${data.especie}</p>
            <img data-species-name="${data.especie}" data-shiny="${!!data.shiny}" src="${getPokemonSpriteUrl(data)}" class="pixel-art h-16 mb-3" onerror="window.pokemonSpriteFallback(this);">
            <span class="text-xs font-black text-red-700 mb-3">EQUIPO / MOCHILA</span>
            <button onclick="window.banPokemon('${selectedBanPlayer}', '${data.id}')" class="cartoon-btn-sm bg-red-200 border-red-700 text-red-900 w-full">🚫 BANEAR</button>
        </div>`).join('');
}

window.selectBanPlayer = function(player) {
    if(player === getMyPlayer() || !PLAYERS.includes(player)) return;
    selectedBanPlayer = player;
    window.updateBanSelectionView();
}

window.backToBanPlayers = function() {
    selectedBanPlayer = '';
    window.updateBanSelectionView();
}

window.banPokemon = async function(targetPlayer, id) {
    const player = getMyPlayer();
    if(!player || !db || targetPlayer === player || !PLAYERS.includes(targetPlayer)) return;
    const selected = globalData.find(data => data.id === id && data.jugador === targetPlayer && data.estado === 'Vivo');
    if(!selected || !confirm(`¿Banear a "${selected.mote}" (${selected.especie}) de ${targetPlayer}?`)) return;

    try {
        const result = await runTransaction(ref(db, userPath()), (users) => {
            const user = users && users[player];
            const target = users && users[targetPlayer];
            const consumables = user && user.inventario && user.inventario.consumibles;
            const pokemon = target && target.pokemon;
            if(!pokemon || !consumables || (consumables.ban || 0) < 1) return;

            if(!pokemon.vivos || !pokemon.vivos[id]) return;
            pokemon.baneados = pokemon.baneados || {};
            const bannedAt = Date.now();
            const livePokemon = pokemon.vivos[id];
            livePokemon.baneos = { ...(livePokemon.baneos || {}), [player]: bannedAt };
            pokemon.baneados[id] = {
                ...livePokemon,
                estadoOriginal: 'Vivo',
                baneadoPor: player,
                baneadoEn: bannedAt
            };
            consumables.ban -= 1;
            return users;
        }, { applyLocally: false });

        if(!result.committed) return alert('No se pudo banear: revisa que el Pokémon siga disponible y que aún tengas la tarjeta.');
        writeLog(player, `Ha baneado a ${selected.mote} (${selected.especie}) de ${targetPlayer} con Tarjeta Roja`);
        writeLog(targetPlayer, `${selected.mote} (${selected.especie}) ha sido baneado por ${player}`);
        alert(`🚫 ${selected.mote} queda baneado y aparece en el apartado Baneados.`);
        selectedBanPlayer = '';
        window.nav('collectibles');
    } catch(error) {
        alert('❌ No se pudo completar el baneo. Comprueba la conexión e inténtalo de nuevo.');
    }
}

window.updateBadgesView = function() {
    const player = getMyPlayer(); const container = document.getElementById('grid-badges'); container.innerHTML = ''; const myBadges = globalBadges[player] || {};
    // Mapeo de IDs de medallas a sus archivos de imagen
    const badgeImages = {
        'b1': 'Medalla1.jpg',
        'b2': 'Medalla2.jpg',
        'b3': 'Medalla3.jpeg',
        'b4': 'Medalla4.jpg',
        'b5': 'Medalla5.jpg',
        'b6': 'Medalla6.jpg',
        'b7': 'Medalla7.jpg',
        'b8': 'Medalla8.jpg'
    };
    const ogBadgeVideos = {
        'b1': 'medalla-og.mp4',
        'b2': 'medalla-og2.mp4'
    };

    GYM_BADGES.forEach((badge, index) => {
        const unlocked = myBadges[badge.id] === true;
        const imageFile = badgeImages[badge.id];
        const ogBadgeVideo = currentLocke === 'PawPatrolOG' ? ogBadgeVideos[badge.id] : '';
        if(ogBadgeVideo && unlocked) {
            container.innerHTML += `<div class="flex flex-col items-center"><div class="badge-slot unlocked"><video src="${ogBadgeVideo}" class="w-16 h-16 object-cover rounded-full cursor-pointer" autoplay muted loop playsinline aria-label="Vídeo de ${badge.name}" onclick="event.stopPropagation(); window.openBadgeVideo('${ogBadgeVideo}')"></video></div><p class="font-bold text-gray-700 mt-2 text-sm">${badge.name}</p></div>`;
        } else if(imageFile) {
            container.innerHTML += `<div class="flex flex-col items-center"><div class="${unlocked ? 'badge-slot unlocked' : 'badge-slot'}" onclick="window.toggleBadge('${badge.id}', '${badge.name}', ${unlocked})">${unlocked ? `<img src="${imageFile}" class="w-16 h-16 object-contain cursor-pointer" onclick="event.stopPropagation(); window.enlargeBadge('${imageFile}')">` : '🔒'}</div><p class="font-bold text-gray-700 mt-2 text-sm">${unlocked ? badge.name : '???'}</p></div>`;
        } else {
            container.innerHTML += `<div class="flex flex-col items-center"><div class="${unlocked ? 'badge-slot unlocked' : 'badge-slot'}" onclick="window.toggleBadge('${badge.id}', '${badge.name}', ${unlocked})">${unlocked ? badge.icon : '🔒'}</div><p class="font-bold text-gray-700 mt-2 text-sm">${unlocked ? badge.name : '???'}</p></div>`;
        }
    });
}

window.enlargeBadge = function(imageSrc) {
    // Crear modal temporal para mostrar la imagen grande
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="cartoon-panel modal-content bg-white relative p-6 text-center" style="max-width: 800px;">
            <button type="button" class="absolute top-4 right-4 text-2xl font-black text-gray-500 cursor-pointer hover:text-red-500">X</button>
            <img src="${imageSrc}" class="w-full h-auto object-contain mx-auto" style="max-height: 85vh;">
        </div>
    `;
    modal.querySelector('button').onclick = () => modal.remove();
    modal.onclick = (e) => { if(e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
}
window.openBadgeVideo = function(videoSource = 'medalla-og.mp4') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="cartoon-panel modal-content bg-white relative p-6 text-center" style="max-width: 800px;">
            <button type="button" class="absolute top-4 right-4 text-2xl font-black text-gray-500 cursor-pointer hover:text-red-500">X</button>
            <video src="${videoSource}" controls autoplay playsinline class="w-full h-auto mx-auto" style="max-height: 85vh;"></video>
        </div>
    `;
    modal.querySelector('button').onclick = () => modal.remove();
    modal.onclick = (event) => { if(event.target === modal) modal.remove(); };
    document.body.appendChild(modal);
};
window.toggleBadge = function(badgeId, badgeName, isUnlocked) {
    if(isUnlocked) return alert("Ya tienes esta medalla.");

    // Determinar el número de gimnasio basado en el ID de la medalla
    const gymMap = { 'b1': '1', 'b2': '2', 'b3': '3', 'b4': '4', 'b5': '5', 'b6': '6', 'b7': '7', 'b8': '8', 'b9': 'league' };
    const gymNumber = gymMap[badgeId] || '';

    // Usar automáticamente el equipo del gimnasio correspondiente
    window.useCurrentTeamForBadge(badgeId, gymNumber);
}

window.useCurrentTeamForBadge = function(badgeId = null, gymNumber = null) {
    const p = getMyPlayer();

    // Si no se pasan parámetros, obtenerlos del modal
    if(!badgeId) badgeId = document.getElementById('badge-id-temp').value;
    if(!gymNumber) {
        const gymMap = { 'b1': '1', 'b2': '2', 'b3': '3', 'b4': '4', 'b5': '5', 'b6': '6', 'b7': '7', 'b8': '8', 'b9': 'league' };
        gymNumber = gymMap[badgeId];
    }

    // Obtener equipo guardado para el gimnasio
    const gymTeam = globalEquiposGimnasio[p]?.[gymNumber] || [];

    // Validar que haya un equipo asignado y no esté vacío
    if(!gymTeam || gymTeam.length === 0) {
        return alert(`❌ No tienes un equipo asignado al ${gymNumber === 'league' ? 'Liga' : 'Gimnasio ' + gymNumber}. Ve a 'Formar Equipo' y asigna uno antes de recibir la medalla.`);
    }

    const teamData = gymTeam.map(poke => ({ especie: poke.especie, mote: poke.mote, shiny: poke.shiny }));

    if(db) {
        Promise.all([
            update(ref(db, userPath(`${p}/medallas`)), { [badgeId]: true }),
            set(ref(db, userPath(`${p}/equiposMedallas/${badgeId}`)), teamData)
        ]).then(() => {
            writeLog(p, `Conseguida la medalla con el equipo del ${gymNumber === 'league' ? 'Liga' : 'Gimnasio ' + gymNumber}`);
            addPoints(p, 50);
            alert(`✅ ¡Medalla registrada con el equipo del ${gymNumber === 'league' ? 'Liga' : 'Gimnasio ' + gymNumber}! (+50 🪙)`);
            nav('badges');
        }).catch((error) => {
            console.error('Error al registrar medalla:', error);
            alert("❌ Error al registrar la medalla: " + error.message);
        });
    } else {
        alert("❌ No hay conexión a la base de datos");
    }
}



// --- CAPTURA FALLIDA ---
document.getElementById('failedCaptureForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const btnSubmit = document.getElementById('btn-submit-failed');
    const enteredRoute = document.getElementById('failedRouteInput').value.trim();
    const routeRaw = getCanonicalRouteEntry(enteredRoute);
    const p = getMyPlayer();

    if (!p) return alert("❌ Debes vincular tu dispositivo primero.");
    if (!enteredRoute) return alert("❌ Debes introducir una ruta/zona.");
    if(!isValidRouteEntry(enteredRoute)) {
        return alert('❌ Selecciona una ruta o zona válida de la lista de autocompletado.');
    }

    const playerFailedRoutes = globalFailedRoutes[p] || [];
    if (playerFailedRoutes.some(r => r.toLowerCase() === routeRaw.toLowerCase())) {
        return alert(`🚫 Ya has registrado "${routeRaw}" anteriormente.`);
    }

    const repeatableOgCapture = currentLocke === 'PawPatrolOG' && isOgRepeatableCapture(routeRaw);
    const alreadyCaptured = globalData.find(x => x.jugador === p && x.ruta.toLowerCase() === routeRaw.toLowerCase());
    if (alreadyCaptured && !repeatableOgCapture) return alert(`🚫 Ya tienes un registro exitoso en "${routeRaw}".`);

    btnSubmit.disabled = true; btnSubmit.innerHTML = "💾 Registrando...";

    try {
        if (db) {
            const newFailedRoutes = [...playerFailedRoutes, routeRaw];
            await set(ref(db, userPath(`${p}/rutasFallidas`)), newFailedRoutes);
            writeLog(p, `Captura fallida registrada en ${routeRaw}`);
        }
        alert("❌ Captura fallida registrada. Esta ruta queda bloqueada para futuras capturas.");
        document.getElementById('failedCaptureForm').reset();
        window.nav('menu');
    } catch (error) {
        console.error("Error registrando captura fallida:", error);
        alert("❌ Error al registrar la captura fallida: " + error.message);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = "❌ REGISTRAR FALLIDA";
    }
});

// --- CAPTURA ---
document.getElementById('trackerForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const btnSubmit = document.getElementById('btn-submit-capture');
    const enteredRoute = document.getElementById('routeInput').value.trim();
    const routeRaw = getCanonicalRouteEntry(enteredRoute);
    const speciesRaw = document.getElementById('speciesInput').value.trim();
    const isShiny = document.getElementById('shinyInput').checked;
    const p = getMyPlayer();

    if(!isValidRouteEntry(enteredRoute)) {
        return alert('❌ Selecciona una ruta o zona válida de la lista de autocompletado.');
    }

    const repeatableOgCapture = currentLocke === 'PawPatrolOG' && isOgRepeatableCapture(routeRaw);
    const playerFailedRoutes = globalFailedRoutes[p] || [];
    if (!repeatableOgCapture && playerFailedRoutes.some(r => r.toLowerCase() === routeRaw.toLowerCase())) {
        return alert(`🚫 Ya has registrado "${routeRaw}" como fallida anteriormente.`);
    }

    const alreadyCaptured = globalData.find(x => x.jugador === p && x.ruta.toLowerCase() === routeRaw.toLowerCase());
    if (alreadyCaptured && !isShiny && !repeatableOgCapture) return alert(`🚫 Ya tienes un registro en "${routeRaw}".\n✨ ¡Solo puedes capturar shiny en rutas ya usadas!`);

    btnSubmit.disabled = true; btnSubmit.innerHTML = "🔍 Pokédex...";

    try {
        const speciesSlug = await resolveSpeciesSlug(speciesRaw);
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesSlug}`);
        if(!res.ok) {
            const error = new Error('La especie no existe.');
            error.code = 'species-not-found';
            throw error;
        }
        const mote = document.getElementById('nicknameInput').value.trim(); const specieFormatted = getSpeciesEnglishName(await res.json());
        const data = { ruta: routeRaw, especie: specieFormatted, mote: mote, shiny: isShiny, inTeam: false, timestamp: Date.now() };

        if(!db) throw new Error('Firebase no está disponible.');
        await push(ref(db, userPath(`${p}/pokemon/vivos`)), data);
        writeLog(p, `Capturado ${mote} (${specieFormatted}) en ${routeRaw}`);
        addPoints(p, 10);
        await playCaptureAnimation(specieFormatted, mote);
        alert("✅ ¡Captura registrada! (+10 🪙)"); document.getElementById('trackerForm').reset(); window.nav('menu');
    } catch (error) {
        console.error('Error registrando la captura:', error);
        if(error.code === 'species-not-found') alert(`❌ "${speciesRaw}" no existe.`);
        else alert('❌ No se pudo guardar la captura. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = "¡CAPTURADO!";
    }
});

// --- VISTAS PERFIL Y EQUIPO ---
window.updateOgCaptureProgress = function() {
    const progressEl = document.getElementById('profile-og-capture-progress');
    const player = getMyPlayer();
    if(!player || currentLocke !== 'PawPatrolOG') {
        progressEl.classList.add('hidden');
        return;
    }

    progressEl.classList.remove('hidden');
    const gymNumber = Number(document.getElementById('profile-og-capture-gym').value) || 1;
    const slots = KALOS_CAPTURE_SLOTS.filter(slot => slot.gymStage <= gymNumber);
    const captures = globalData.filter(record => record.jugador === player);
    const failures = globalFailedRoutes[player] || [];
    const pendingSlots = slots.filter(slot =>
        !isKalosCaptureSlotCompleted(slot, captures, failures));
    document.getElementById('profile-og-capture-progress-count').textContent =
        `${pendingSlots.length} capturas pendientes`;
    const pendingList = document.getElementById('profile-og-capture-progress-list');
    pendingList.replaceChildren();
    if(pendingSlots.length) {
        pendingSlots.forEach(slot => {
            const item = document.createElement('li');
            item.textContent = slot.progressName;
            pendingList.appendChild(item);
        });
    } else {
        const item = document.createElement('li');
        item.textContent = 'Ninguna';
        pendingList.appendChild(item);
    }
};

window.updateProfileView = function() {
    const p = getMyPlayer();
    if (!p) {
        document.getElementById('profile-locked-area').classList.remove('hidden');
        document.getElementById('btn-formar-equipo').classList.add('hidden');
        document.getElementById('locked-player-name').innerText = 'Sin entrenador vinculado';
        document.getElementById('profile-account-email').innerText = currentAccountEmail;
        document.getElementById('profile-my-skin').classList.add('hidden');
        document.getElementById('profile-gym-teams').classList.add('hidden');
        document.getElementById('profile-og-capture-progress').classList.add('hidden');
        document.getElementById('grid-profile').innerHTML = '';
        document.getElementById('profile-failed-routes').classList.add('hidden');
        return;
    }
    else { document.getElementById('profile-locked-area').classList.remove('hidden'); document.getElementById('btn-formar-equipo').classList.remove('hidden'); document.getElementById('locked-player-name').innerText = p; }
    document.getElementById('profile-account-email').innerText = currentAccountEmail;

    const acts = globalActivos[p] || {}; const bannerEl = document.getElementById('profile-my-banner'); const skinEl = document.getElementById('profile-my-skin');
    bannerEl.className = `mt-4 mx-auto w-fit px-8 py-3 player-banner flex items-center justify-center gap-4 text-2xl md:text-4xl title-font uppercase ${acts.banner || 'bg-gray-800'}`;
    if(acts.skin) { skinEl.src = `https://play.pokemonshowdown.com/sprites/trainers/${getSkinSpriteId(acts.skin)}.png`; skinEl.classList.remove('hidden'); } else skinEl.classList.add('hidden');

    const playerFailedRoutes = globalFailedRoutes[p] || [];
    const failedRoutesEl = document.getElementById('profile-failed-routes');
    const failedRoutesList = document.getElementById('failed-routes-list');
    if (playerFailedRoutes.length > 0) {
        failedRoutesEl.classList.remove('hidden');
        failedRoutesList.innerHTML = playerFailedRoutes.map(route => `<span class="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded">${route}</span>`).join('');
    } else {
        failedRoutesEl.classList.add('hidden');
    }
    window.updateOgCaptureProgress();

    const gymSelector = document.getElementById('profile-gym-selector');
    const gymTeamsDiv = document.getElementById('profile-gym-teams');
    let selectedGym = gymSelector.value;

    // Si no hay gimnasio seleccionado, seleccionar el primero por defecto
    if(!selectedGym) {
        selectedGym = '1';
        gymSelector.value = '1';
    }

    // Mostrar desplegable si hay equipos guardados o siempre mostrarlo
    gymTeamsDiv.classList.remove('hidden');

    const myActive = globalData.filter(x => x.jugador === p && x.estado === 'Vivo');
    let myTeam, myBox;

    // Mostrar SOLO el equipo guardado para el gimnasio
    const gymTeam = (globalEquiposGimnasio[p]?.[selectedGym] || [])
        .filter(poke => currentLocke !== 'PawPatrolOG' ||
            globalData.some(data => data.id === poke.id && data.jugador === p && data.estado === 'Vivo'))
        .filter(poke => currentLocke !== 'PawPatrolOG' || isPokemonAllowedForGym(poke.ruta, selectedGym));
    // Añadir propiedades necesarias para generateCardsHTML
    myTeam = gymTeam.map(poke => ({
        ...poke,
        jugador: p,
        estado: 'Vivo',
        _gymNumber: selectedGym
    }));
    // Mostrar TODOS los Pokémon vivos en la mochila (independientemente de si están en el equipo)
    myBox = myActive;

    const myDead = globalData.filter(x => x.jugador === p && x.estado === 'Muerto');
    const myBanned = globalData.filter(x => x.jugador === p && x.estado === 'Baneado');

    // Filtrar Pokémon bloqueados por otros jugadores (que están en vivos pero tienen baneos)
    const myBlocked = myActive.filter(x => x.baneos && Object.keys(x.baneos).length > 0);

    const teamTitle = `⚔️ Equipo ${selectedGym === 'league' ? 'Liga' : 'Gimnasio ' + selectedGym}`;

    // Determinar si se permite matar Pokémon (todos los gimnasios, pero comportamiento diferente)
    const allowKill = true;
    const preserveDeadInEarlyGyms = allowsDeadPokemonForGym(selectedGym);

    document.getElementById('grid-profile').innerHTML = `<div class="col-span-full mb-2"><h3 class="title-font text-3xl text-white text-shadow-hard uppercase">${teamTitle}</h3></div>` + generateCardsHTML(myTeam, false, false, true, false, true, true, false, false, false, allowKill, 'Equipo vacío. Ve a "Formar Equipo" para asignar Pokémon.', preserveDeadInEarlyGyms) + `<div class="col-span-full mb-2"><h3 class="title-font text-3xl text-white text-shadow-hard uppercase mt-6">🌟 Mochila (PC)</h3></div>` + generateCardsHTML(myBox, true, false, false, false, true, true, false) + `<div class="col-span-full mb-2"><h3 class="title-font text-3xl text-white text-shadow-hard uppercase mt-6">🪦 Cementerio</h3></div>` + generateCardsHTML(myDead, false, true, false, false, true, false, false, false, true) + (myBlocked.length > 0 ? `<div class="col-span-full mb-2"><h3 class="title-font text-3xl text-white text-shadow-hard uppercase mt-6">🔒 Bloqueados</h3></div>` + generateCardsHTML(myBlocked, false, false, false, false, false, false, true) : '') + `<div class="col-span-full mb-2"><h3 class="title-font text-3xl text-white text-shadow-hard uppercase mt-6">⛔ Baneados</h3></div>` + generateCardsHTML(myBanned, false, false, false, true, true, false, false);
    applyPokemonTypeStyles(document.getElementById('grid-profile'));
};

window.onGymSelectorChange = function() {
    // No limpiar la selección, cada gimnasio mantiene su propia selección
    cancelTeamAutocomplete();
    window.updateTeambuilderView();
}

function allowsDeadPokemonForGym(gymNumber) {
    return currentLocke !== 'PawPatrolOG' && (gymNumber === '1' || gymNumber === '2');
}

function getEligibleTeamPokemon(player, gymNumber) {
    let myActive = globalData.filter(pokemon => pokemon.jugador === player && pokemon.estado === 'Vivo');
    myActive = myActive.filter(pokemon => !pokemon.baneos || Object.keys(pokemon.baneos).length === 0);

    if(allowsDeadPokemonForGym(gymNumber)) {
        const myDead = globalData.filter(pokemon => pokemon.jugador === player && pokemon.estado === 'Muerto');
        const validDead = myDead.filter(pokemon => isPokemonAllowedForGym(pokemon.ruta, gymNumber));
        const deadAsAlive = validDead.map(pokemon => ({ ...pokemon, estado: 'Vivo', _originalEstado: 'Muerto' }));
        myActive = [...myActive, ...deadAsAlive];
    }

    return myActive.filter(pokemon => isPokemonAllowedForGym(pokemon.ruta, gymNumber));
}

window.updateTeambuilderView = function() {
    const p = getMyPlayer();
    const gymNumber = document.getElementById('teambuilder-gym-selector').value;
    const myActive = getEligibleTeamPokemon(p, gymNumber);

    // Inicializar selección para este gimnasio si no existe
    if(!gymTeamSelection[gymNumber]) {
        gymTeamSelection[gymNumber] = [];
    }

    // Cargar equipo guardado solo la primera vez que se entra al gimnasio
    if(!gymTeamSelectionLoaded[gymNumber]) {
        const savedTeam = globalEquiposGimnasio[p]?.[gymNumber] || [];
        // Solo V2 permite conservar Pokémon muertos en los equipos de gimnasios 1 y 2.
        if(allowsDeadPokemonForGym(gymNumber)) {
            gymTeamSelection[gymNumber] = savedTeam.map(poke => poke.id);
        } else {
            // Filtrar solo los Pokémon que están vivos actualmente
            const livePokemonIds = globalData.filter(x => x.jugador === p && x.estado === 'Vivo').map(x => x.id);
            gymTeamSelection[gymNumber] = savedTeam.map(poke => poke.id).filter(id => livePokemonIds.includes(id));
        }
        if(currentLocke === 'PawPatrolOG') {
            const eligiblePokemonIds = new Set(myActive.map(pokemon => pokemon.id));
            gymTeamSelection[gymNumber] = gymTeamSelection[gymNumber].filter(id => eligiblePokemonIds.has(id));
        }
        gymTeamSelectionLoaded[gymNumber] = true;
    }

    if(currentLocke === 'PawPatrolOG') {
        const eligiblePokemonIds = new Set(myActive.map(pokemon => pokemon.id));
        gymTeamSelection[gymNumber] = (gymTeamSelection[gymNumber] || []).filter(id => eligiblePokemonIds.has(id));
    }
    const currentSelection = gymTeamSelection[gymNumber] || [];

    const preserveDeadInEarlyGyms = allowsDeadPokemonForGym(gymNumber);
    document.getElementById('grid-teambuilder').innerHTML = `<div class="col-span-full text-center title-font text-2xl text-gray-700 mb-2">Miembros actuales: ${currentSelection.length}/6 (puede estar vacío)</div>` + myActive.map(data => {
        const isSelected = currentSelection.includes(data.id);
        const isOriginallyDead = data._originalEstado === 'Muerto';
        return `
        <div class="poke-card cartoon-panel ${isSelected ? 'in-team-bg bg-blue-50' : 'bg-white'} ${isOriginallyDead ? 'grayscale-dead' : ''} p-4 flex flex-col items-center text-center relative border-[4px]" data-pokemon-id="${data.id}" data-species="${slugifySpeciesName(data.especie)}" data-search="${data.ruta} ${data.especie} ${data.mote}">
            ${isSelected ? '<div class="absolute top-[-15px] left-[-15px] text-3xl">⭐</div>' : ''}
            ${isOriginallyDead ? '<div class="absolute top-[-15px] right-[-15px] text-3xl">💀</div>' : ''}
            <h3 class="font-bold text-xl uppercase truncate w-full mb-1">"${data.mote}"</h3><p class="text-sm font-bold text-gray-500 mb-2">${data.especie}</p>
            <p class="text-xs text-blue-600 font-bold">📍 ${data.ruta}</p>
            <img data-species-name="${data.especie}" data-shiny="${!!data.shiny}" onclick="window.openViewModal('${data.id}', '${data.jugador}', '${data._originalEstado || data.estado || 'Vivo'}', '${gymNumber}')" src="${getPokemonSpriteUrl(data, isOriginallyDead)}" class="pixel-art scale-[1.5] h-16 mb-4 cursor-pointer" onerror="window.pokemonSpriteFallback(this);">
            <div class="flex flex-col gap-2 w-full mt-auto">
                <button onclick="window.openViewModal('${data.id}', '${data.jugador}', '${data._originalEstado || data.estado || 'Vivo'}', '${gymNumber}')" class="cartoon-btn-sm bg-yellow-100 border-yellow-800 text-yellow-800">ℹ️ Ficha</button>
                ${isSelected ? `<button onclick="window.openEditModal('${data.id}', true)" class="cartoon-btn-sm teambuilder-action-btn bg-indigo-100 border-indigo-600 text-indigo-700 mb-2">⚙️ Personalizar</button>` : ''}
                ${isSelected ? `<button onclick="window.killFromTeamBuilder('${data.id}', ${preserveDeadInEarlyGyms})" class="cartoon-btn-sm teambuilder-action-btn bg-red-100 border-red-600 text-red-600 mb-2">💀 Ha muerto</button>` : ''}
                <button onclick="window.toggleTeam('${data.id}', ${!isSelected})" class="cartoon-btn-sm teambuilder-action-btn ${isSelected ? 'bg-red-100 border-red-600 text-red-600' : 'bg-green-100 border-green-600 text-green-700'}">${isSelected ? '❌ Quitar' : '➕ Añadir'}</button>
            </div></div>`;
    }).join('');
    applyPokemonTypeStyles(document.getElementById('grid-teambuilder'));
    updateTeamWeaknessSummary(myActive.filter(pokemon => currentSelection.includes(pokemon.id)));
};

window.toggleTeam = function(id, newState) {
    cancelTeamAutocomplete();
    const gymNumber = document.getElementById('teambuilder-gym-selector').value;
    // Inicializar selección para este gimnasio si no existe
    if(!gymTeamSelection[gymNumber]) {
        gymTeamSelection[gymNumber] = [];
    }
    const currentSelection = gymTeamSelection[gymNumber];

    // Modo gimnasio - usar selección específica del gimnasio
    if(newState && currentSelection.length >= 6) return alert("❌ ¡Ya tienes 6 Pokémon en el equipo!");
    if(newState) {
        currentSelection.push(id);
    } else {
        gymTeamSelection[gymNumber] = currentSelection.filter(x => x !== id);
    }
    window.updateTeambuilderView();
};

function openDeathDedication(id, preserveDeadInEarlyGyms = false) {
    const pokeData = globalData.find(x => x.id === id);
    if(!pokeData) return;
    if(deathAnimationTimeout) clearTimeout(deathAnimationTimeout);
    if(deathAnimationPokemonId) {
        document.querySelectorAll('.poke-card[data-pokemon-id]').forEach(card => {
            if(card.dataset.pokemonId === deathAnimationPokemonId) {
                card.classList.remove('death-shake');
                const oldSprite = card.querySelector('img');
                if(oldSprite) oldSprite.classList.remove('death-sprite');
            }
        });
    }
    deathAnimationPokemonId = id;
    document.getElementById('dedicatoria-poke-id').value = id;
    document.getElementById('dedicatoria-is-new-death').value = 'true';
    document.getElementById('dedicatoria-pokemon-name').innerText = `"${pokeData.mote}" (${pokeData.especie})`;
    document.getElementById('dedicatoria-text').value = '';
    document.getElementById('dedicatoria-poke-id').dataset.preserveDeadInEarlyGyms = preserveDeadInEarlyGyms;
    document.getElementById('modal-dedicatoria').dataset.deathPokemonId = id;
    const card = [...document.querySelectorAll('.poke-card[data-pokemon-id]')]
        .find(candidate => candidate.dataset.pokemonId === id);
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.body.classList.remove('screen-shake');
    void document.body.offsetWidth;
    document.body.classList.add('screen-shake');
    if(card) {
        card.classList.remove('death-shake');
        const sprite = card.querySelector('img');
        if(sprite) sprite.classList.remove('death-sprite');
        void card.offsetWidth;
        card.classList.add('death-shake');
        if(sprite) sprite.classList.add('death-sprite');
    }
    deathAnimationTimeout = setTimeout(() => {
        document.getElementById('modal-dedicatoria').style.display = 'flex';
        deathAnimationTimeout = null;
    }, reducedMotion ? 1 : 650);
}

function clearDeathAnimation() {
    if(deathAnimationTimeout) clearTimeout(deathAnimationTimeout);
    deathAnimationTimeout = null;
    document.body.classList.remove('screen-shake');
    if(deathAnimationPokemonId) {
        document.querySelectorAll('.poke-card[data-pokemon-id]').forEach(card => {
            if(card.dataset.pokemonId === deathAnimationPokemonId) {
                card.classList.remove('death-shake');
                const sprite = card.querySelector('img');
                if(sprite) sprite.classList.remove('death-sprite');
            }
        });
    }
    deathAnimationPokemonId = null;
}

window.closeDeathDedication = function() {
    document.getElementById('modal-dedicatoria').style.display = 'none';
    clearDeathAnimation();
};
window.killFromTeamBuilder = openDeathDedication;
window.killFromProfile = openDeathDedication;
window.kill = openDeathDedication;

window.unbanPokemon = function(id) {
    const p = getMyPlayer();
    const poke = globalData.find(x => x.id === id && x.jugador === p);
    if(!poke) return;

    if(!confirm(`🔓 ¿Desbloquear a "${poke.mote}"?`)) return;

    if(db) {
        const result = runTransaction(ref(db, userPath(`${p}/pokemon`)), (pokemon) => {
            if(!pokemon) return;
            for(const collection of ['vivos', 'muertos', 'baneados']) {
                if(pokemon[collection] && pokemon[collection][id]) {
                    const pokeData = pokemon[collection][id];
                    if(pokeData.baneos) {
                        delete pokeData.baneos;
                        delete pokeData.baneadoPor;
                        delete pokeData.baneadoEn;
                        delete pokeData.estadoOriginal;
                    }
                    return pokemon;
                }
            }
            return;
        }, { applyLocally: false });

        if(result.committed) {
            writeLog(p, `Desbloqueó a ${poke.mote} (${poke.especie})`);
            alert(`✅ ${poke.mote} ha sido desbloqueado.`);
            window.updateProfileView();
        } else {
            alert("❌ No se pudo desbloquear. El Pokémon ya no está disponible.");
        }
    }
}

window.editDedicatoria = function(id) {
    const poke = globalData.find(x => x.id === id);
    if(!poke) return;

    clearDeathAnimation();
    delete document.getElementById('modal-dedicatoria').dataset.deathPokemonId;
    document.getElementById('dedicatoria-poke-id').value = id;
    document.getElementById('dedicatoria-is-new-death').value = 'false';
    document.getElementById('dedicatoria-pokemon-name').innerText = `"${poke.mote}" (${poke.especie})`;
    document.getElementById('dedicatoria-text').value = poke.dedicatoria || '';
    document.getElementById('modal-dedicatoria').style.display = 'flex';
};

window.saveGymTeam = function() {
    const p = getMyPlayer();
    const gymNumber = document.getElementById('teambuilder-gym-selector').value;

    if(!gymNumber) return alert("❌ Debes seleccionar un gimnasio o la liga para guardar el equipo.");

    // Obtener la selección específica del gimnasio actual
    const currentSelection = gymTeamSelection[gymNumber] || [];

    // Obtener los datos completos de los Pokémon seleccionados
    // Para gimnasio 1 y 2, permitir también muertos
    const selectedPokemon = currentSelection.map(id => {
        const poke = globalData.find(x => x.id === id && x.jugador === p);
        if(poke) return poke;
        // Si no se encuentra (puede ser muerto que no aparece en globalData normales)
        return null;
    }).filter(x => x);

    // Verificar que todos los Pokémon sean válidos para el gimnasio
    const invalidPokemon = selectedPokemon.filter(poke => !isPokemonAllowedForGym(poke.ruta, gymNumber));
    if(invalidPokemon.length > 0) {
        const invalidNames = invalidPokemon.map(p => `"${p.mote}" (${p.ruta})`).join(', ');
        return alert(`❌ Los siguientes Pokémon no son válidos para este gimnasio: ${invalidNames}`);
    }

    // Obtener el equipo ya guardado para este gimnasio para preservar datos específicos
    const existingGymTeam = globalEquiposGimnasio[p]?.[gymNumber] || [];

    const teamData = selectedPokemon.map(poke => {
        // Buscar si este Pokémon ya está en el equipo guardado del gimnasio
        const existingPoke = existingGymTeam.find(p => p.id === poke.id);

        // Si ya existe, preservar sus datos específicos (item, ability, moves)
        // Si no existe, usar los datos globales
        return {
            id: poke.id,
            especie: poke.especie,
            mote: poke.mote,
            ruta: poke.ruta,
            shiny: poke.shiny,
            nivel: poke.nivel || '',
            item: existingPoke && Object.prototype.hasOwnProperty.call(existingPoke, 'item') ? existingPoke.item : (poke.item || ''),
            ability: existingPoke && Object.prototype.hasOwnProperty.call(existingPoke, 'ability') ? existingPoke.ability : (poke.ability || ''),
            nature: existingPoke && Object.prototype.hasOwnProperty.call(existingPoke, 'nature') ? existingPoke.nature : (poke.nature || ''),
            moves: existingPoke && Array.isArray(existingPoke.moves)
                ? [...existingPoke.moves]
                : (Array.isArray(poke.moves) ? [...poke.moves] : ['', '', '', ''])
        };
    });

    if(db) {
        set(ref(db, userPath(`${p}/equipos/${gymNumber}`)), teamData)
            .then(() => {
                // Actualizar en memoria local
                if(!globalEquiposGimnasio[p]) globalEquiposGimnasio[p] = {};
                globalEquiposGimnasio[p][gymNumber] = teamData;
                gymTeamSelectionLoaded[gymNumber] = true; // Marcar como cargado
                alert(`✅ Equipo guardado para ${gymNumber === 'league' ? 'Liga' : 'Gimnasio ' + gymNumber} (${teamData.length === 0 ? 'vacío' : teamData.length + ' Pokémon'})`);
                // NO limpiar la selección para que los Pokémon sigan marcados
                window.updateTeambuilderView(); // Actualizar vista del teambuilder
                window.updateProfileView(); // Actualizar vista del perfil también
            })
            .catch((error) => {
                console.error('Error al guardar equipo:', error);
                alert("❌ Error al guardar el equipo: " + error.message);
            });
    }
}

window.openEditModal = function(id, isGymEdit = false) {
    const p = globalData.find(x => x.id === id); document.getElementById('edit-poke-id').value = id;
    if(!p || p.jugador !== getMyPlayer()) return alert('Solo puedes editar Pokémon de tu perfil.');

    // Configurar el modo de edición
    document.getElementById('edit-mode').value = isGymEdit ? 'gym' : 'profile';
    document.getElementById('edit-modal-title').innerText = isGymEdit ? '⚙️ PERSONALIZAR EQUIPO' : '✏️ EDITAR POKÉMON';

    // Mostrar/ocultar campos según el modo
    document.getElementById('edit-mode-profile').classList.toggle('hidden', isGymEdit);
    document.getElementById('edit-mode-gym').classList.toggle('hidden', !isGymEdit);

    if(isGymEdit) {
        // Modo gimnasio: cargar datos específicos del equipo
        const gymNumber = document.getElementById('teambuilder-gym-selector').value;
        const gymTeam = globalEquiposGimnasio[p.jugador]?.[gymNumber] || [];
        const gymPokemon = gymTeam.find(poke => poke.id === id);
        const pokemonData = gymPokemon ? { ...p, ...gymPokemon } : p;

        document.getElementById('modal-pokemon-name').innerText = `"${pokemonData.mote}" (${pokemonData.especie})`;
        document.getElementById('edit-item').value = pokemonData.item || '';
        document.getElementById('edit-ability').value = pokemonData.ability || '';
        document.getElementById('edit-nature').value = pokemonData.nature || '';
        const moves = pokemonData.moves || ['', '', '', ''];
        document.getElementById('edit-m1').value = moves[0] || '';
        document.getElementById('edit-m2').value = moves[1] || '';
        document.getElementById('edit-m3').value = moves[2] || '';
        document.getElementById('edit-m4').value = moves[3] || '';
    } else {
        // Modo perfil: solo mote y ruta
        document.getElementById('modal-pokemon-name').innerText = `"${p.mote}" (${p.especie})`;
        document.getElementById('edit-mote').value = p.mote || '';
        document.getElementById('edit-route').value = p.ruta || '';
    }

    document.getElementById('modal-edit-pokemon').style.display = 'flex';
};

document.getElementById('editPokeForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const id = document.getElementById('edit-poke-id').value; const player = getMyPlayer();
    const editMode = document.getElementById('edit-mode').value;
    try {
        if(editMode === 'profile') {
            // Modo perfil: solo editar mote y ruta
            const mote = document.getElementById('edit-mote').value.trim();
            const enteredRoute = document.getElementById('edit-route').value.trim();
            const ruta = getCanonicalRouteEntry(enteredRoute);

            if(!player || !db || !mote) return alert('El mote y la ruta son obligatorios.');
            if(!isValidRouteEntry(enteredRoute)) return alert('❌ Selecciona una ruta o zona válida de la lista de autocompletado.');

            const result = await runTransaction(ref(db, userPath(`${player}/pokemon`)), (pokemon) => {
                if(!pokemon) return;
                for(const collection of ['vivos', 'muertos', 'baneados']) {
                    if(pokemon[collection] && pokemon[collection][id]) {
                        pokemon[collection][id].mote = mote;
                        pokemon[collection][id].ruta = ruta;
                        return pokemon;
                    }
                }
                return;
            });

            if(result.committed) {
                document.getElementById('modal-edit-pokemon').style.display = 'none';
                alert("✅ Pokémon actualizado.");
                window.updateProfileView();
            } else {
                alert("❌ No se pudo actualizar. El Pokémon ya no está disponible.");
            }
        } else {
            // Modo gimnasio: editar item, ability, nature y moves específicos del gimnasio
            await universalDictionariesReady;
            const item = validarEntrada(document.getElementById('edit-item').value, 'items', 'Objeto');
            const ability = validarEntrada(document.getElementById('edit-ability').value, 'abilities', 'Habilidad');
            const nature = validarEntrada(document.getElementById('edit-nature').value, 'natures', 'Naturaleza');
            const moves = [
                validarEntrada(document.getElementById('edit-m1').value.replace(/^- /g, ''), 'moves', 'Ataque 1'),
                validarEntrada(document.getElementById('edit-m2').value.replace(/^- /g, ''), 'moves', 'Ataque 2'),
                validarEntrada(document.getElementById('edit-m3').value.replace(/^- /g, ''), 'moves', 'Ataque 3'),
                validarEntrada(document.getElementById('edit-m4').value.replace(/^- /g, ''), 'moves', 'Ataque 4')
            ];

            const gymNumber = document.getElementById('teambuilder-gym-selector').value;
            const gymTeam = globalEquiposGimnasio[player]?.[gymNumber] || [];
            const pokemonIndex = gymTeam.findIndex(poke => poke.id === id);

            if(pokemonIndex === -1) {
                alert("❌ El Pokémon no está en el equipo actual del gimnasio.");
                return;
            }

            const updatedGymTeam = gymTeam.map((poke, index) => index === pokemonIndex
                ? { ...poke, item, ability, nature, moves: [...moves] }
                : poke);

            // Guardar en Firebase
            await set(ref(db, userPath(`${player}/equipos/${gymNumber}`)), updatedGymTeam);
            // Actualizar en memoria local
            if(!globalEquiposGimnasio[player]) globalEquiposGimnasio[player] = {};
            globalEquiposGimnasio[player][gymNumber] = updatedGymTeam;

            document.getElementById('modal-edit-pokemon').style.display = 'none';
            alert("✅ Datos del equipo del gimnasio actualizados.");
            window.updateTeambuilderView();
            window.updateProfileView();
        }
    } catch (error) {
        console.error('Error al editar:', error);
        alert("❌ Error al editar: " + error.message);
    }
});

window.openViewModal = function(id, player, state, gymNumber = '') {
    const basePokemon = globalData.find(x => x.id === id && (!player || x.jugador === player) && (!state || x.estado === state))
        || (gymNumber ? globalData.find(x => x.id === id && (!player || x.jugador === player)) : null);
    if(!basePokemon || basePokemon.jugador !== getMyPlayer()) return;
    const gymPokemon = gymNumber ? globalEquiposGimnasio[basePokemon.jugador]?.[gymNumber]?.find(poke => poke.id === id) : null;
    const p = gymPokemon ? { ...basePokemon, ...gymPokemon } : basePokemon;
    document.getElementById('view-mote').innerText = `"${p.mote}" ${p.shiny ? '✨' : ''}`; document.getElementById('view-especie-ruta').innerText = `${p.especie} -📍 ${p.ruta}`;
    const gymContext = document.getElementById('view-gym-context');
    gymContext.innerText = gymNumber ? `DATOS DEL ${gymNumber === 'league' ? 'EQUIPO DE LA LIGA' : 'GIMNASIO ' + gymNumber}` : '';
    gymContext.classList.toggle('hidden', !gymNumber);
    const viewSprite = document.getElementById('view-sprite');
    viewSprite.dataset.speciesName = p.especie;
    viewSprite.dataset.shiny = !!p.shiny;
    viewSprite.onerror = () => window.pokemonSpriteFallback(viewSprite);
    viewSprite.src = getPokemonSpriteUrl(p, p.estado === 'Muerto');
    document.getElementById('view-level').innerText = p.nivel || '??'; document.getElementById('view-gender').innerText = p.gender || '---';
    document.getElementById('view-item').innerText = p.item || 'Ninguno';
    document.getElementById('view-ability').innerText = p.ability || '---';
    document.getElementById('view-nature').innerText = p.nature || '---';
    document.getElementById('view-moves').innerHTML = (p.moves || []).map(m => m ? `<li>${m}</li>` : '').join('') || '<li>Sin movimientos</li>';
    let statusNote = document.getElementById('view-status-note');
    if(!statusNote) {
        statusNote = document.createElement('p');
        statusNote.id = 'view-status-note';
        statusNote.className = 'hidden whitespace-pre-line font-bold text-center text-emerald-800 bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3 mb-4';
        document.getElementById('view-especie-ruta').insertAdjacentElement('afterend', statusNote);
    }
    const legalNotes = [];
    if(p.revividoPor) legalNotes.push(`💚 Revivido con Revivir Máximo por ${p.revividoPor}${p.revividoEn ? ` el ${new Date(p.revividoEn).toLocaleString('es-ES')}` : ''}.`);
    const banSenders = new Set(Object.keys(p.baneos || {}));
    if(p.baneadoPor) banSenders.add(p.baneadoPor);
    if(banSenders.size > 0 || p.estado === 'Baneado') legalNotes.push(`🚫 Tarjeta Roja enviada por ${[...banSenders].join(', ') || p.baneadoPor || 'un jugador'}. Solo aplica al combate PvP contra quien la envió; el Pokémon sigue disponible en el resto de la aventura.`);
    statusNote.textContent = legalNotes.join('\n');
    statusNote.classList.toggle('hidden', legalNotes.length === 0);
    document.getElementById('modal-view-pokemon').style.display = 'flex';
};

window.openCaptureEditModal = function(id) {
    const capture = globalData.find(data => data.id === id && data.jugador === getMyPlayer());
    if(!capture) return alert('No se encontró esta captura en tu perfil.');
    document.getElementById('edit-capture-id').value = id;
    document.getElementById('edit-capture-species').innerText = capture.especie;
    document.getElementById('edit-capture-nickname').value = capture.mote || '';
    document.getElementById('edit-capture-route').value = capture.ruta || '';
    document.getElementById('modal-edit-capture').style.display = 'flex';
};

document.getElementById('editCaptureForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const player = getMyPlayer();
    const id = document.getElementById('edit-capture-id').value;
    const mote = document.getElementById('edit-capture-nickname').value.trim();
    const enteredRoute = document.getElementById('edit-capture-route').value.trim();
    const ruta = getCanonicalRouteEntry(enteredRoute);
    if(!player || !id || !mote || !db) return;
    if(currentLocke === 'PawPatrolV2' && !isValidRouteEntry(enteredRoute)) {
        return alert('❌ Selecciona una ruta o zona válida de la lista de autocompletado.');
    }

    try {
        const result = await runTransaction(ref(db, userPath(`${player}/pokemon`)), (pokemon) => {
            if(!pokemon) return;
            for(const collection of ['vivos', 'muertos', 'baneados']) {
                if(pokemon[collection] && pokemon[collection][id]) {
                    pokemon[collection][id].mote = mote;
                    pokemon[collection][id].ruta = ruta;
                    return pokemon;
                }
            }
            return;
        }, { applyLocally: false });

        if(!result.committed) return alert('No se pudo modificar: la captura ya no está disponible.');
        writeLog(player, `Ha corregido los datos de ${mote} (${ruta})`);
        document.getElementById('modal-edit-capture').style.display = 'none';
        alert('✅ Mote y ruta actualizados en todas las vistas.');
    } catch(error) {
        alert('❌ No se pudo guardar. Comprueba la conexión e inténtalo de nuevo.');
    }
});

window.exportShowdown = async function() {
    try {
        await universalDictionariesReady;
    } catch(error) {
        console.error('No se pudo preparar la traducción del equipo para Showdown:', error);
        return alert('❌ No se pudo cargar el diccionario de traducción. Comprueba la conexión e inténtalo de nuevo.');
    }

    const gymNumber = document.getElementById('teambuilder-gym-selector').value;
    const p = getMyPlayer();

    const gymLevels = currentLocke === 'PawPatrolOG' ? OG_GYM_EXPORT_LEVELS : {
        '1': 13, '2': 18, '3': 24, '4': 30, '5': 33,
        '6': 39, '7': 43, '8': 51, league: 59
    };
    const targetLevel = gymLevels[gymNumber];
    if(!targetLevel) return alert('❌ No se encontró el límite de nivel para este gimnasio.');

    // Obtener equipo del gimnasio seleccionado (usar datos guardados específicos del gimnasio)
    const savedTeam = globalEquiposGimnasio[p]?.[gymNumber] || [];
    const teamIds = gymTeamSelection[gymNumber] || [];

    // Combinar datos globales con datos específicos del gimnasio
    const team = teamIds.map(id => {
        const globalPoke = globalData.find(poke => poke.id === id && poke.jugador === p);
        const gymPoke = savedTeam.find(poke => poke.id === id);
        if(gymPoke && globalPoke) {
            // Usar datos específicos del gimnasio para item, ability, nature y moves
            return {
                ...globalPoke,
                item: Object.prototype.hasOwnProperty.call(gymPoke, 'item') ? gymPoke.item : globalPoke.item,
                ability: Object.prototype.hasOwnProperty.call(gymPoke, 'ability') ? gymPoke.ability : globalPoke.ability,
                nature: Object.prototype.hasOwnProperty.call(gymPoke, 'nature') ? gymPoke.nature : globalPoke.nature,
                moves: Array.isArray(gymPoke.moves) ? [...gymPoke.moves] : globalPoke.moves
            };
        }
        return globalPoke;
    }).filter(x => x);

    if(team.length === 0) return alert("❌ No tienes Pokémon seleccionados para el equipo.");

    let exportText = "";
    team.forEach(poke => {
        let nameLine = poke.mote ? `${poke.mote} (${poke.especie})` : poke.especie;
        const gender = String(poke.gender || '').trim().replace(/^\((.*)\)$/, '$1');
        if(gender) nameLine += ` (${gender})`;
        if(poke.item) nameLine += ` @ ${traducirAlIngles(poke.item, 'items')}`;
        exportText += nameLine + "\n";
        if(poke.ability) exportText += `Ability: ${traducirAlIngles(poke.ability, 'abilities')}\n`;
        exportText += `Level: ${targetLevel}\n`;
        if(poke.shiny) exportText += `Shiny: Yes\n`;
        if(poke.nature) exportText += `${traducirAlIngles(poke.nature, 'natures')} Nature\n`;
        (poke.moves || []).forEach(m => { if(m) exportText += `- ${traducirAlIngles(m, 'moves')}\n`; }); exportText += "\n";
    });
    const txtArea = document.getElementById('copy-clipboard-area'); txtArea.value = exportText.trim(); txtArea.select(); document.execCommand('copy');
    alert("📋 ¡Copiado para Showdown!\nSe ha traducido el equipo al inglés de forma automática y se han asignado los niveles según el gimnasio.");
};

window.evolve = async function(id, btnElement) {
    let p = globalData.find(x => x.id === id); const originalText = btnElement.innerHTML; btnElement.innerHTML = "⏳ Buscando..."; btnElement.disabled = true;
    try {
        const sName = await resolveSpeciesSlug(p.especie); const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${sName}`);
        if (!res.ok) throw new Error(); const dataS = await res.json(); const resE = await fetch(dataS.evolution_chain.url); const dataE = await resE.json();
        let queue = [dataE.chain]; let foundNode = null;
        while (queue.length > 0) { let curr = queue.shift(); if (curr.species.name === sName) { foundNode = curr; break; } curr.evolves_to.forEach(c => queue.push(c)); }
        let newSp = "";
        if (foundNode && foundNode.evolves_to.length > 0) {
            if (foundNode.evolves_to.length === 1) newSp = foundNode.evolves_to[0].species.name;
            else newSp = prompt(`🌟 Evolución múltiple (${foundNode.evolves_to.map(e => e.species.name).join(", ")}).\n¿A cuál ha evolucionado?`);
        } else return alert("❌ Este Pokémon ya está en su fase final.");
        if (newSp && newSp.trim() !== "") {
            const form = await getSpeciesDisplayName(await resolveSpeciesSlug(newSp));
            if(db) { await update(ref(db, userPath(`${getMyPlayer()}/pokemon/vivos/${id}`)), { especie: form }); writeLog(getMyPlayer(), `El Pokémon ${p.mote} evolucionó a ${form}`); }
        }
    } catch (error) {
        const manual = prompt("⚠️ Error de red.\nEscribe a mano a qué Pokémon evoluciona:");
        if (manual && manual.trim() !== "") {
            const form = formatSpeciesName(manual);
            if(db) { await update(ref(db, userPath(`${getMyPlayer()}/pokemon/vivos/${id}`)), { especie: form }); writeLog(getMyPlayer(), `El Pokémon ${p.mote} evolucionó manualmente a ${form}`); }
        }
    } finally { btnElement.innerHTML = originalText; btnElement.disabled = false; }
};

window.deevolve = async function(id) {
    const p = globalData.find(x => x.id === id);
    if(!p || p.jugador !== getMyPlayer()) return alert('Solo puedes desevolucionar tus Pokémon.');

    try {
        const sName = await resolveSpeciesSlug(p.especie);
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${sName}`);
        if (!res.ok) return;
        const dataS = await res.json();
        const resE = await fetch(dataS.evolution_chain.url);
        const dataE = await resE.json();

        let prevSp = "";
        let queue = [dataE.chain];
        let foundNode = null;
        let parentNode = null;

        while (queue.length > 0) {
            let curr = queue.shift();
            if (curr.species.name === sName) {
                foundNode = curr;
                break;
            }
            if (curr.evolves_to && curr.evolves_to.length > 0) {
                for (let child of curr.evolves_to) {
                    if (child.species.name === sName) {
                        parentNode = curr;
                        foundNode = child;
                        break;
                    }
                    queue.push(child);
                }
            }
        }

        if (!parentNode) return;

        prevSp = parentNode.species.name;

        if (prevSp && prevSp.trim() !== "") {
            const form = await getSpeciesDisplayName(prevSp);
            if(db) {
                await update(ref(db, userPath(`${getMyPlayer()}/pokemon/vivos/${id}`)), { especie: form });
                writeLog(getMyPlayer(), `El Pokémon ${p.mote} fue desevolucionado a ${form} (BBC)`);
            }
        }
    } catch (error) {
        return;
    }
};

document.getElementById('dedicatoriaForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const id = document.getElementById('dedicatoria-poke-id').value;
    const dedicatoria = document.getElementById('dedicatoria-text').value.trim();
    const isNewDeath = document.getElementById('dedicatoria-is-new-death')?.value === 'true';
    const preserveDeadInEarlyGyms = document.getElementById('dedicatoria-poke-id').dataset.preserveDeadInEarlyGyms === 'true';

    if (db) {
        const p = getMyPlayer();
        const pokeData = globalData.find(x => x.id === id);

        if(isNewDeath) {
            // Es una nueva muerte
            const copyData = { ...pokeData }; delete copyData.id; delete copyData.jugador; delete copyData.estado; copyData.inTeam = false;
            if(dedicatoria) copyData.dedicatoria = dedicatoria;
            set(ref(db, userPath(`${p}/pokemon/muertos/${id}`)), copyData).then(() => {
                remove(ref(db, userPath(`${p}/pokemon/vivos/${id}`)));

                // En OG los Pokémon muertos se eliminan de todos los equipos; V2 conserva su excepción en gimnasios 1 y 2.
                if(currentLocke === 'PawPatrolOG' || !preserveDeadInEarlyGyms) {
                    const gymTeamsToRemoveFrom = currentLocke === 'PawPatrolOG'
                        ? ['1', '2', '3', '4', '5', '6', '7', '8', 'league']
                        : ['3', '4', '5', '6', '7', '8', 'league'];
                    gymTeamsToRemoveFrom.forEach(gymNum => {
                        const gymTeam = globalEquiposGimnasio[p]?.[gymNum] || [];
                        const filteredTeam = gymTeam.filter(poke => poke.id !== id);
                        if(filteredTeam.length !== gymTeam.length) {
                            // El Pokémon estaba en este equipo, actualizarlo
                            set(ref(db, userPath(`${p}/equipos/${gymNum}`)), filteredTeam);
                            // Actualizar también en memoria local para que la vista se actualice inmediatamente
                            if(globalEquiposGimnasio[p]) {
                                globalEquiposGimnasio[p][gymNum] = filteredTeam;
                            }
                            // Eliminar también de la selección del teambuilder para este gimnasio
                            if(gymTeamSelection[gymNum]) {
                                gymTeamSelection[gymNum] = gymTeamSelection[gymNum].filter(x => x !== id);
                            }
                        }
                    });
                }

                writeLog(p, `¡BAJA! ${pokeData.mote} (${pokeData.especie}) ha muerto.`); addPoints(p, -10);
                window.closeDeathDedication();
                alert(`💀 ${pokeData.mote} ha pasado al cementerio.`);
                window.updateProfileView();
                window.updateTeambuilderView();
            }).catch(error => {
                console.error('Error al registrar la muerte:', error);
                window.closeDeathDedication();
                alert('❌ No se pudo registrar la muerte. Comprueba la conexión e inténtalo de nuevo.');
            });
        } else {
            // Es edición de dedicatoria existente
            // Encontrar en qué colección está el Pokémon
            const collections = ['vivos', 'muertos', 'baneados'];
            let foundCollection = null;
            for(const collection of collections) {
                if(pokeData.estado.toLowerCase() === collection.replace('s', '') || (collection === 'muertos' && pokeData.estado === 'Muerto')) {
                    foundCollection = collection;
                    break;
                }
            }

            if(foundCollection) {
                const updateData = dedicatoria ? { dedicatoria: dedicatoria } : { dedicatoria: null };
                update(ref(db, userPath(`${p}/pokemon/${foundCollection}/${id}`)), updateData).then(() => {
                    writeLog(p, `Editó la dedicatoria de ${pokeData.mote} (${pokeData.especie})`);
                    window.closeDeathDedication();
                    alert(`✅ Dedicatoria actualizada.`);
                    window.updateProfileView();
                }).catch((error) => {
                    console.error('Error al actualizar dedicatoria:', error);
                    alert("❌ No se pudo actualizar. El Pokémon ya no está disponible.");
                });
            } else {
                alert("❌ No se pudo encontrar el Pokémon en la base de datos.");
            }
        }
    }
});

function generateCardsHTML(list, isInteractive = false, isDead = false, isViewMode = false, isBanned = false, canEditCapture = false, showBBC = false, isPublicView = false, showUnban = false, showEditDedicatoria = false, allowKill = false, emptyMessage = null, preserveDeadInEarlyGyms = false) {
    if (list.length === 0) return `<div class="col-span-full cartoon-panel p-6 text-center font-bold">${emptyMessage || 'No hay registros.'}</div>`;
    return `<div class="col-span-full grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">` + list.map(data => `
        <div class="poke-card cartoon-panel flex flex-col items-center text-center relative border-4 ${isDead ? 'grayscale-dead' : (data.shiny ? 'shiny-bg' : 'bg-white')}" data-pokemon-id="${data.id}" data-species="${slugifySpeciesName(data.especie)}" data-search="${data.ruta} ${data.especie} ${data.mote}">
            <h3 class="font-bold text-lg uppercase truncate w-full mb-1">"${data.mote}" ${data.shiny ? '✨' : ''}</h3><p class="text-sm font-bold text-gray-500 mb-2">${data.especie}</p>
            <img data-species-name="${data.especie}" data-shiny="${!!data.shiny}" ${isPublicView ? '' : `onclick="window.openViewModal('${data.id}', '${data.jugador}', '${data.estado}', '${data._gymNumber || ''}')"`} src="${getPokemonSpriteUrl(data, isDead)}" class="pixel-art scale-[1.5] h-16 mb-2 ${isPublicView ? '' : 'cursor-pointer'}" onerror="window.pokemonSpriteFallback(this);">
            <p class="text-[10px] text-gray-400 font-black tracking-wider uppercase mb-2">📍 ${data.ruta}</p>
            ${isDead && data.dedicatoria ? `<p class="text-xs text-gray-600 italic mb-2 px-2">"${data.dedicatoria}"</p>` : ''}
            <div class="flex flex-col gap-2 w-full mt-auto">
                ${!isPublicView ? `<button onclick="window.openViewModal('${data.id}', '${data.jugador}', '${data.estado}', '${data._gymNumber || ''}')" class="cartoon-btn-sm bg-yellow-100 border-yellow-800 text-yellow-800">🔍 ${isViewMode ? 'Ver Info' : 'Ficha'}</button>` : ''}
                ${canEditCapture && !isPublicView ? `<button onclick="window.openEditModal('${data.id}', false)" class="cartoon-btn-sm profile-edit-btn bg-amber-100 border-amber-700 text-amber-900">✏️ Editar Pokémon</button>` : ''}
                ${showEditDedicatoria && isDead && !isPublicView ? `<button onclick="window.editDedicatoria('${data.id}')" class="cartoon-btn-sm profile-edit-btn bg-purple-100 border-purple-700 text-purple-900">📝 Editar Dedicatoria</button>` : ''}
                ${showBBC && !isDead && !isBanned && !isPublicView ? `<button onclick="window.deevolve('${data.id}')" class="cartoon-btn-sm profile-edit-btn bg-purple-100 border-purple-700 text-purple-900">🔄 BBC</button>` : ''}
                ${showUnban && !isPublicView ? `<button onclick="window.unbanPokemon('${data.id}')" class="cartoon-btn-sm profile-edit-btn bg-green-100 border-green-700 text-green-900">🔓 Desbloquear</button>` : ''}
                ${isPublicView && (isBanned || data.baneadoPor || Object.keys(data.baneos || {}).length > 0 || data.revividoPor) ? `<div class="w-full rounded-xl border-2 border-amber-300 bg-amber-50 p-2 text-left text-xs font-bold text-gray-800">${isBanned || data.baneadoPor || Object.keys(data.baneos || {}).length > 0 ? `<p>🚫 Tarjeta Roja: ${data.baneadoPor || Object.keys(data.baneos || {}).join(', ')}</p>` : ''}${data.revividoPor ? '<p>💚 Revivido: Sí</p>' : ''}</div>` : ''}
                ${isBanned ? `<div class="bg-red-800 text-white text-sm font-bold py-2 rounded-xl w-full">⛔ BANEADO${data.baneadoPor ? ' POR ' + data.baneadoPor.toUpperCase() : ''}</div>` : (isInteractive ? `<button onclick="window.evolve('${data.id}', this)" class="cartoon-btn-sm bg-blue-100 border-blue-800 text-blue-800">🌟 Evolucionar</button><button onclick="window.kill('${data.id}')" class="cartoon-btn-sm bg-red-100 border-red-800 text-red-800">💀 Ha muerto</button>` : (allowKill && !isDead ? `<button onclick="window.killFromProfile('${data.id}', ${preserveDeadInEarlyGyms})" class="cartoon-btn-sm bg-red-100 border-red-800 text-red-800">💀 Ha muerto</button>` : (isDead ? `<div class="bg-gray-800 text-white text-sm font-bold py-1 rounded-full w-full">DEBILITADO</div>` : '')))}
            </div>
        </div>`).join('') + `</div>`;
}

function renderGroupedList(list, containerId, isPublicView = false) {
    const container = document.getElementById(containerId); container.innerHTML = '';
    if (list.length === 0) return container.innerHTML = `<div class="cartoon-panel p-6 text-center font-bold">Sin registros.</div>`;
    PLAYERS.forEach(player => {
        const playerMons = list.filter(p => p.jugador === player);
        if(playerMons.length > 0) {
            const acts = globalActivos[player] || {};
            const bannerClass = acts.banner || 'bg-gray-800';
            const skinImg = acts.skin ? `<img src="https://play.pokemonshowdown.com/sprites/trainers/${getSkinSpriteId(acts.skin)}.png" class="h-10 pixel-art inline-block mr-2">` : '';
            container.innerHTML += `<div class="w-full mb-8"><div class="player-banner ${bannerClass} px-6 py-2 title-font text-3xl mb-4 ml-2 inline-flex items-center">${skinImg}${player}</div>${generateCardsHTML(playerMons, false, containerId === 'grid-cemetery', false, false, false, false, isPublicView)}</div>`;
        }
    });
    applyPokemonTypeStyles(container);
}

function renderRepelentes() {
    const container = document.getElementById('grid-view-repelentes');
    const records = [...globalRepelentes].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    container.innerHTML = '';
    if(records.length === 0) {
        container.innerHTML = '<div class="cartoon-panel p-5 text-center font-bold text-gray-500">Todavía no hay usos registrados.</div>';
        return;
    }

    records.forEach(record => {
        const entry = document.createElement('div');
        entry.className = 'cartoon-panel p-4 border-cyan-500 bg-cyan-50';
        const author = document.createElement('p');
        author.className = 'font-black text-cyan-900 mb-2';
        author.textContent = `${record.jugador} · ${record.timestamp ? new Date(record.timestamp).toLocaleString('es-ES') : ''}`;
        const route = document.createElement('p');
        route.className = 'font-bold text-gray-800';
        route.textContent = `📍 Ruta: ${record.ruta}`;
        const encounter = document.createElement('p');
        encounter.className = 'text-gray-700';
        encounter.textContent = `Ignorado: ${record.pokemonIgnorado} · Capturado después: ${record.pokemonCapturado}`;
        entry.append(author, route, encounter);
        container.appendChild(entry);
    });
}

window.changeRank = function(player, field, amount) {
    if(!db || !LOCKE_PLAYERS[currentLocke]?.includes(player) || !['victorias', 'derrotas'].includes(field)) return;
    const current = (rankingData[player] && rankingData[player][field]) ? rankingData[player][field] : 0;
    const newVal = Math.max(0, current + amount);
    update(ref(db, userPath(`${player}/ranking`)), { [field]: newVal });
    if(field === 'victorias' && amount > 0) { addPoints(player, 100); writeLog(player, "Suma +1 Victoria (+100 🪙)"); }
}

function renderRanking() {
    const rankingArray = (LOCKE_PLAYERS[currentLocke] || []).map(name => ({ name, victorias: rankingData[name]?.victorias || 0, derrotas: rankingData[name]?.derrotas || 0 })).sort((a, b) => b.victorias - a.victorias || a.derrotas - b.derrotas);
    document.getElementById('ranking-body').innerHTML = rankingArray.map((p, i) => {
        let medal = i === 0 ? '👑' : i === 1 ? '🔥' : i === 2 ? '⭐' : `${i + 1}`;
        const acts = globalActivos[p.name] || {};
        const skinHtml = acts.skin ? `<img src="https://play.pokemonshowdown.com/sprites/trainers/${getSkinSpriteId(acts.skin)}.png" class="h-10 pixel-art inline-block mr-2">` : '';
        const bannerHtml = `<div class="player-banner ${acts.banner||'bg-gray-800'} px-4 py-1 text-sm inline-flex items-center">${skinHtml}${p.name}</div>`;
        return `<tr class="hover:bg-gray-50 transition"><td class="p-3 title-font text-2xl">${medal}</td><td class="p-3 text-left font-black uppercase text-gray-800">${bannerHtml}</td><td class="p-3"><div class="flex items-center justify-center gap-2"><button onclick="window.changeRank('${p.name}', 'victorias', -1)" class="bg-gray-200 px-2 rounded font-bold hover:bg-gray-300">-</button><span class="text-green-600 text-2xl font-black">${p.victorias}</span><button onclick="window.changeRank('${p.name}', 'victorias', 1)" class="bg-green-200 text-green-800 px-2 rounded font-bold hover:bg-green-300">+</button></div></td><td class="p-3"><div class="flex items-center justify-center gap-2"><button onclick="window.changeRank('${p.name}', 'derrotas', -1)" class="bg-gray-200 px-2 rounded font-bold hover:bg-gray-300">-</button><span class="text-red-600 text-2xl font-black">${p.derrotas}</span><button onclick="window.changeRank('${p.name}', 'derrotas', 1)" class="bg-red-200 text-red-800 px-2 rounded font-bold hover:bg-red-300">+</button></div></td></tr>`;
    }).join('');
}

// Cambio de fondo automático
const backgrounds = ['fondo.jpg', 'fondo2.jpg', 'fondo3.jpg',  'fondo6.jpg', 'fondo7.jpg', 'fondo8.jpg'];
let currentBgIndex = 0;

function changeBackground() {
    currentBgIndex = (currentBgIndex + 1) % backgrounds.length;
    document.body.style.backgroundImage = `url('${backgrounds[currentBgIndex]}')`;
}

setInterval(changeBackground, 5000);

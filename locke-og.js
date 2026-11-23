export const OG_GYM_EXPORT_LEVELS = {
    '1': 12, '2': 25, '3': 32, '4': 34, '5': 37,
    '6': 42, '7': 48, '8': 59, league: 68
};

export const OG_ROUTE = (locations, habitats = [], label = '', suggestions = [], repeatable = false, aliases = []) =>
    ({ locations, habitats, label, suggestions, repeatable, aliases });
export const OG_GYM_ROUTES = {
    '1': [
        OG_ROUTE(['Inicial', 'pueblo boceto', 'inicial de pueblo boceto'], [], 'Pueblo Boceto - Inicial', ['Inicial', 'Pueblo Boceto', 'Inicial de Pueblo Boceto']),
        OG_ROUTE(['ruta 2'], ['hierba normal']),
        OG_ROUTE(['bosque novarte'], ['hierba normal']),
        OG_ROUTE(['ruta 3'], ['hierba normal']),
        OG_ROUTE(['ruta 22'], ['hierba normal']),
    ],
    '2': [
        OG_ROUTE(['ruta 4'], ['flores rojas']),
        OG_ROUTE(['ruta 4'], ['flores amarillas']),
        OG_ROUTE(['Laboratorio', 'Ciudad Luminalia'], [], 'Ciudad Luminalia - Laboratorio', ['Laboratorio', 'Ciudad Luminalia']),
        OG_ROUTE(['ruta 5'], ['hierba normal']),
        OG_ROUTE(['ruta 5'], ['flores moradas']),
        OG_ROUTE(['ruta 6'], ['hierba normal']),
        OG_ROUTE(['ruta 6'], [], 'Ruta 6-Arbusto'),
        OG_ROUTE(['palacio cenit'], ['hierba normal']),
        OG_ROUTE(['ruta 7'], ['hierba normal']),
        OG_ROUTE(['ruta 7'], ['flores amarillas']),
        OG_ROUTE(['ruta 7'], ['flores moradas']),
        OG_ROUTE(['ruta 7'], [], 'Ruta 7 - Snorlax', ['Ruta 7 - Snorlax', 'Snorlax']),
        OG_ROUTE(['gruta tierraunida']),
        OG_ROUTE(['ruta 8'], ['flores amarillas']),
        OG_ROUTE(['ruta 8'], ['hierba normal']),
        OG_ROUTE(['pueblo petroglifo']),
        OG_ROUTE(['pueblo petroglifo - fosil'], [], 'Pueblo Petroglifo - Fósil', [], true, ['Pueblo Vánitas (Revivir fósiles)']),
        OG_ROUTE(['ruta 9']),
        OG_ROUTE(['cueva brillante']),
        OG_ROUTE(['ciudad relieve'], [], 'Ciudad Relieve (Regalos / Intercambios / Pesca)')
    ],
    '3': [
        OG_ROUTE(['ruta 10'], ['hierba normal']),
        OG_ROUTE(['ruta 10'], ['flores amarillas']),
        OG_ROUTE(['ruta 11'], ['hierba normal']),
        OG_ROUTE(['cueva de los reflejos', 'cueva reflejos']),
        OG_ROUTE(['ciudad yantra', 'torre maestria', 'lucario'], [], 'Ciudad Yantra / Torre Maestría (Lucario)')
    ],
    '4': [
        OG_ROUTE(['ruta 12'], ['hierba normal']),
        OG_ROUTE(['ruta 12'], ['flores amarillas']),
        OG_ROUTE(['bahia azul'], ['hierba normal']),
        OG_ROUTE(['bahia azul'], ['flores amarillas'])
    ],
    '5': [OG_ROUTE(['ruta 13'])],
    '6': [OG_ROUTE(['ruta 14'], ['flores rojas'])],
    '7': [
        OG_ROUTE(['ruta 15'], ['hierba normal']),
        OG_ROUTE(['ruta 15'], ['flores amarillas']),
        OG_ROUTE(['hotel desolacion']),
        OG_ROUTE(['ruta 16'], ['hierba normal']),
        OG_ROUTE(['ruta 16'], ['flores amarillas']),
        OG_ROUTE(['caverna helada'])
    ],
    '8': [
        OG_ROUTE(['ruta 17']),
        OG_ROUTE(['ruta 18'], ['hierba normal']),
        OG_ROUTE(['ruta 18'], ['flores rojas']),
        OG_ROUTE(['cueva terminus']),
        OG_ROUTE(['ruta 19'], ['hierba normal']),
        OG_ROUTE(['ruta 19'], ['flores amarillas']),
        OG_ROUTE(['ruta 19'], ['flores moradas']),
        OG_ROUTE(['ruta 20'], ['hierba normal']),
        OG_ROUTE(['villa pokemon'], ['hierba normal']),
        OG_ROUTE(['villa pokemon'], ['flores amarillas']),
        OG_ROUTE(['villa pokemon'], ['flores rojas'])
    ],
    'league': [
        OG_ROUTE(['ruta 21'], ['flores rojas']),
        OG_ROUTE(['ruta 21'], ['flores moradas']),
        OG_ROUTE(['calle victoria'], ['cueva']),
        OG_ROUTE(['calle victoria'], ['flores amarillas'])
    ]
};

export const OG_ROUTE_LOCATION_LABELS = {
    'pueblo boceto': 'Pueblo Boceto',
    'bosque novarte': 'Bosque Novarte',
    'ciudad luminalia': 'Ciudad Luminalia',
    'palacio cenit': 'Palacio Cenit',
    'gruta tierraunida': 'Gruta Tierraunida',
    'pueblo vanitas': 'Pueblo Vánitas',
    'pueblo petroglifo': 'Pueblo Petroglifo',
    'cueva brillante': 'Cueva Brillante',
    'cueva de los reflejos': 'Cueva Reflejos',
    'torre maestria': 'Torre Maestría',
    'ciudad yantra': 'Ciudad Yantra',
    'bahia azul': 'Bahía Azul',
    'hotel desolacion': 'Hotel Desolación',
    'caverna helada': 'Gruta Helada',
    'cueva terminus': 'Cueva Desenlace',
    'villa pokemon': 'Villa Pokémon',
    'calle victoria': 'Calle Victoria'
};

export function getOgRouteSuggestions() {
    return [...new Set(Object.values(OG_GYM_ROUTES).flat().flatMap(area => {
        if(area.label) return [area.label, ...area.suggestions];
        const location = area.locations[0];
        const locationLabel = OG_ROUTE_LOCATION_LABELS[location]
            || location.replace(/\b\w/g, character => character.toUpperCase());
        const habitatLabel = area.habitats[0]
            ? area.habitats[0].replace(/\b\w/g, character => character.toUpperCase())
            : '';
        return [habitatLabel ? `${locationLabel} - ${habitatLabel}` : locationLabel, ...area.suggestions];
    }))];
}


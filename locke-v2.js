export const V2_CAPTURE_AREA = (mapLocationId, gym, suggestions, aliases = []) => ({
    mapLocationId,
    gym,
    suggestions,
    aliases: [...new Set([...suggestions, ...aliases])]
});
export const V2_CAPTURE_AREAS = [
    V2_CAPTURE_AREA('ciudad_engobe', 1, ['Ciudad Engobe - Inicial'], ['Ciudad Engobe', 'Engobe', 'Inicial']),
    V2_CAPTURE_AREA('ruta_19', 1, ['Ruta 19 - Hierba verde'], ['Ruta 19', '19']),
    V2_CAPTURE_AREA('ruta_20', 1, ['Ruta 20 - Hierba verde', 'Ruta 20 - Hierba azul'], ['Ruta 20', '20']),
    V2_CAPTURE_AREA('rancho_ocre', 1, ['Rancho Ocre - Hierba verde'], ['Rancho Ocre', 'Rancho', 'Ocre']),
    V2_CAPTURE_AREA('poligono_hormigon', 2, ['Polígono Hormigón - Exterior - Hierba verde', 'Polígono Hormigón - Interior - Hierba verde', 'Polígono Hormigón - Interior - Hierba azul'], ['Polígono Hormigón', 'Hormigón', 'Hormigon']),
    V2_CAPTURE_AREA('cloacas_porcelana', 3, ['Cloacas Porcelana - Cueva/agua'], ['Cloacas Porcelana', 'Alcantarillas']),
    V2_CAPTURE_AREA('gruta_antigua', 3, ['Pasadizo Ancestral - Cueva'], ['Pasadizo Ancestral', 'Pasadizo', 'Reliquia', 'Gruta Antigua']),
    V2_CAPTURE_AREA('parque_porcelana', 3, ['Parque Porcelana - Hierba verde', 'Parque Porcelana - Hierba azul'], ['Parque Porcelana']),
    V2_CAPTURE_AREA('ruta_4', 4, ['Ruta 4 - Arena'], ['Ruta 4', '4']),
    V2_CAPTURE_AREA('zona_desierto', 4, ['Zona Desierto - Arena'], ['Zona Desierto', 'Zona Desértica', 'Desierto', 'Desértica']),
    V2_CAPTURE_AREA('castillo_ancestral', 4, ['Castillo Ancestral - Interior'], ['Castillo Ancestral', 'Castillo', 'Ancestral']),
    V2_CAPTURE_AREA('ruta_16', 4, ['Ruta 16 - Hierba verde', 'Ruta 16 - Hierba azul'], ['Ruta 16', '16']),
    V2_CAPTURE_AREA('bosque_perdido', 4, ['Bosque Perdidos - Hierba verde', 'Bosque Perdidos - Hierba azul'], ['Bosque Perdidos', 'Bosque Perdido', 'Bosque']),
    V2_CAPTURE_AREA('claro_oculto_bosque_perdidos', 4, ['Claro Oculto (Bosque Perdidos)']),
    V2_CAPTURE_AREA('ruta_5', 4, ['Ruta 5 - Hierba verde', 'Ruta 5 - Hierba azul'], ['Ruta 5', '5']),
    V2_CAPTURE_AREA('claro_oculto_ruta_5', 4, ['Claro Oculto (Ruta 5 - obligatorio con Bel)']),
    V2_CAPTURE_AREA('puente_fayenza', 5, ['Puente Fayenza - Sombras de Pokémon voladores'], ['Puente de Fayenza', 'Puente Fayenza']),
    V2_CAPTURE_AREA('ciudad_fayenza', 5, ['Ciudad Fayenza - Regalo Zorua'], ['Ciudad Fayenza', 'Zorua regalo', 'Fayenza']),
    V2_CAPTURE_AREA('ruta_6', 5, ['Ruta 6 - Hierba verde', 'Ruta 6 - Hierba azul'], ['Ruta 6', '6']),
    V2_CAPTURE_AREA('centro_estudios_estacionales', 5, ['Centro de Estudios Estacionales - Regalo Deerling'], ['Centro Estudios Estacionales', 'Deerling regalo']),
    V2_CAPTURE_AREA('claro_oculto_ruta_6_norte', 5, ['Claro Oculto (Ruta 6 - Norte)']),
    V2_CAPTURE_AREA('engobe_agua_surf', 6, ['Ciudad Engobe - Agua (Surf)']),
    V2_CAPTURE_AREA('fayenza_agua_surf', 6, ['Ciudad Fayenza - Agua (Surf)']),
    V2_CAPTURE_AREA('claro_oculto_rancho_ocre', 6, ['Claro Oculto (Rancho Ocre - Surf)']),
    V2_CAPTURE_AREA('claro_oculto_ruta_6_sur', 6, ['Claro Oculto (Ruta 6 - Sur - Surf)']),
    V2_CAPTURE_AREA('cueva_loza', 6, ['Cueva Loza - Cueva'], ['Cueva Loza', 'Loza']),
    V2_CAPTURE_AREA('cueva_electrorroca', 6, ['Cueva Electrorroca - Cueva'], ['Cueva Electrorroca', 'Electrorroca']),
    V2_CAPTURE_AREA('ruta_7', 6, ['Ruta 7 - Hierba verde', 'Ruta 7 - Hierba azul'], ['Ruta 7', '7']),
    V2_CAPTURE_AREA('claro_oculto_ruta_7', 6, ['Claro Oculto (Ruta 7)']),
    V2_CAPTURE_AREA('torre_cielos', 6, ['Torre de los Cielos - Interior'], ['Torre de los Cielos', 'Torre Cielos', 'Cielos']),
    V2_CAPTURE_AREA('montana_reversia', 7, ['Montaña Reversia - Exterior - Hierba verde', 'Montaña Reversia - Interior - Cueva'], ['Montaña Reversia', 'Reversia']),
    V2_CAPTURE_AREA('bahia_arenisca', 7, ['Bahía Arenisca - Agua (Surf)'], ['Bahía Arenisca', 'Arenisca']),
    V2_CAPTURE_AREA('ruta_13', 7, ['Ruta 13 - Hierba verde', 'Ruta 13 - Hierba azul'], ['Ruta 13', '13']),
    V2_CAPTURE_AREA('claro_oculto_ruta_13_norte', 7, ['Claro Oculto (Ruta 13 - Norte)']),
    V2_CAPTURE_AREA('claro_oculto_ruta_13_sur', 7, ['Claro Oculto (Ruta 13 - Sur)']),
    V2_CAPTURE_AREA('ruta_12', 7, ['Ruta 12 - Hierba verde', 'Ruta 12 - Hierba azul'], ['Ruta 12', '12']),
    V2_CAPTURE_AREA('puente_villa', 7, ['Puente Villa - Hierba verde', 'Puente Villa - Hierba azul'], ['Puente Villa', 'Villa']),
    V2_CAPTURE_AREA('ruta_11', 7, ['Ruta 11 - Hierba verde', 'Ruta 11 - Hierba azul'], ['Ruta 11', '11']),
    V2_CAPTURE_AREA('ruta_9', 7, ['Ruta 9 - Hierba verde', 'Ruta 9 - Hierba azul'], ['Ruta 9', '9']),
    V2_CAPTURE_AREA('claro_oculto_ruta_9', 7, ['Claro Oculto (Ruta 9)']),
    V2_CAPTURE_AREA('ciudad_marga', 8, ['Ciudad Marga - Agua (Surf)'], ['Ciudad Marga', 'Marga']),
    V2_CAPTURE_AREA('ruta_21', 8, ['Ruta 21 - Agua (Surf)'], ['Ruta 21', '21']),
    V2_CAPTURE_AREA('gruta_marina', 8, ['Cueva Costera - Cueva'], ['Cueva Costera', 'Gruta Marina', 'Costera']),
    V2_CAPTURE_AREA('ruta_22', 8, ['Ruta 22 - Hierba verde', 'Ruta 22 - Hierba azul'], ['Ruta 22', '22']),
    V2_CAPTURE_AREA('claro_oculto_ruta_22', 8, ['Claro Oculto (Ruta 22)']),
    V2_CAPTURE_AREA('boquete_gigante', 9, ['Boquete Gigante - Exterior - Hierba verde', 'Boquete Gigante - Cueva', 'Boquete Gigante - Cráter - Hierba verde', 'Boquete Gigante - Cráter - Hierba azul'], ['Boquete Gigante', 'Gigante']),
    V2_CAPTURE_AREA('claro_oculto_boquete_gigante', 9, ['Claro Oculto (Boquete Gigante - interior del cráter)']),
    V2_CAPTURE_AREA('ruta_23', 9, ['Ruta 23 - Hierba verde', 'Ruta 23 - Hierba azul'], ['Ruta 23', '23']),
    V2_CAPTURE_AREA('claro_oculto_ruta_23', 9, ['Claro Oculto (Ruta 23 - requiere Corte)']),
    V2_CAPTURE_AREA('calle_victoria', 9, ['Calle Victoria - Cueva', 'Calle Victoria - Exterior - Hierba verde', 'Calle Victoria - Exterior - Hierba azul'], ['Calle Victoria', 'Victoria'])
];
export const V2_LEGACY_GYM_ROUTE_KEYWORDS = {
    '1': ['Engobe', '19', 'Ocre', '20', 'Rancho', 'Inicial'],
    '2': ['Hormigon', 'Hormigón'],
    '3': ['Porcelana', 'Alcantarillas', 'Pasadizo', 'Reliquia'],
    '4': ['4', 'Zona', 'Desértica', 'Desertica', 'Castillo', 'Ancestral', '16', 'Perdido', 'Perdidos', 'Bosque'],
    '5': ['5', 'Fayenza'],
    '6': ['Reliquia', '6', 'Loza', 'Electrorroca', '7', 'Cielos'],
    '7': ['Reversia', 'Horroris', 'Arenisca', '13', '14', 'Ladrillo', '12', 'Villa', '11', '9'],
    '8': ['Marga', '22'],
    league: ['21', 'Costera', 'Gigante', '23', 'Victoria']
};

export function getV2CaptureRouteSuggestions() {
    return [...new Set(V2_CAPTURE_AREAS.flatMap(area => area.suggestions))];
}

export function getV2CaptureArea(route, normalizeRouteKeyword) {
    const normalize = value => normalizeRouteKeyword(value).replace(/\bcon\b/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizedRoute = normalize(route);
    if(!normalizedRoute) return null;

    let bestMatch = null;
    let bestMatchLength = 0;
    V2_CAPTURE_AREAS.forEach(area => {
        area.aliases.forEach(alias => {
            const normalizedAlias = normalize(alias);
            if(normalizedAlias && ` ${normalizedRoute} `.includes(` ${normalizedAlias} `) && normalizedAlias.length > bestMatchLength) {
                bestMatch = area;
                bestMatchLength = normalizedAlias.length;
            }
        });
    });
    return bestMatch;
}

export function canonicalizeV2PokemonRoute(route, normalizeRouteKeyword) {
    const normalizedRoute = normalizeRouteKeyword(route);
    if(!normalizedRoute) return route;
    const exactSuggestion = getV2CaptureRouteSuggestions().find(suggestion =>
        normalizeRouteKeyword(suggestion) === normalizedRoute
    );
    if(exactSuggestion) return exactSuggestion;
    return getV2CaptureArea(route, normalizeRouteKeyword)?.suggestions[0] || route;
}


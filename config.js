// ── game config ───────────────────────────────────────────────────────────────
//  Edit values here. Reload the page to apply.
// ─────────────────────────────────────────────────────────────────────────────

var IDLE_CONFIG = {

    gen: {
        max: 100,   // generator capacity
        award: 5,   // gen restored per correct answer
        shotCost: 1,   // gen per vulcan shot
        idleDrain: 0.3    // gen lost per second passively
    },

    shields: {
        max: 80,  // maximum shield hp
        regen: 7,  // shields restored per second while regenerating
        regenGenCost: 10,  // gen drained per second while regenerating
        regenDelay: 0.5   // seconds after last hit before regen begins
    },

    armour: {
        max: 30            // maximum armour hp (does not regenerate)
    },

    enemy: {
        type1Hp: 3,  // standard enemy hp
        type2Hp: 6,  // heavy enemy hp
        initialSpawnDelay: 8,  // seconds before first enemy spawns on load
        resetSpawnDelay: 8   // seconds before next enemy after wave gap
    },

    // ── waves ─────────────────────────────────────────────────────────────────
    //  Each wave runs for `duration` seconds then hands off to the next.
    //  The array loops forever.
    //
    //  duration    — how long this wave phase lasts (seconds)
    //  gap         — minimum seconds between spawns within this wave
    //  maxEnemies  — max enemies on screen at once during this wave
    //  enemyHp     — hp of enemies spawned in this wave
    //  enemyVy     — downward speed of enemies (pixels/sec)
    // ─────────────────────────────────────────────────────────────────────────
    waves: [
        { label: 'trickle', duration: 20, gap: 4.0, maxEnemies: 1, enemyHp: 3, enemyVy: 70 },
        { label: 'swarm', duration: 12, gap: 1.5, maxEnemies: 2, enemyHp: 2, enemyVy: 90 },
        { label: 'silence', duration: 6, gap: 999, maxEnemies: 0, enemyHp: 3, enemyVy: 70 },
        { label: 'swarm', duration: 14, gap: 1.0, maxEnemies: 3, enemyHp: 2, enemyVy: 110 },
        { label: 'heavy', duration: 16, gap: 3.0, maxEnemies: 2, enemyHp: 6, enemyVy: 80 },
    ]

};
// ── game config ───────────────────────────────────────────────────────────────
//  Edit values here. Reload the page to apply.
// ─────────────────────────────────────────────────────────────────────────────

var IDLE_CONFIG = {

    gen: {
        max:        100,   // generator capacity
        award:        5,   // gen restored per correct answer
        shotCost:     1,   // gen per vulcan shot
        idleDrain:  0.3    // gen lost per second passively
    },

    shields: {
        max:          80,  // maximum shield hp
        regen:        7,  // shields restored per second while regenerating
        regenGenCost: 10,  // gen drained per second while regenerating
        regenDelay:  0.5   // seconds after last hit before regen begins
    },

    armour: {
        max: 30            // maximum armour hp (does not regenerate)
    },

    enemy: {
        type1Hp:          3,   // standard enemy hp
        type2Hp:          6,   // heavy enemy hp
        initialSpawnDelay: 8, // seconds before first enemy spawns on load
        resetSpawnDelay:   8  // seconds before first enemy spawns after game over
    }

};

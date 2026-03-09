# The Beacon (Scene 9)

A tall glass pillar stands on a dark mirror floor, lit from within, against a starfield backdrop.

## Environment

Dark texture environment using a starfield image (`ORBX/assets/starfield.jpg`). Very low power — just enough to provide subtle ambient fill and stars in the background. No daylight.

## Floor

A large mirror floor stretching out beneath the pillar. Dark glossy material — high specular reflection, very low roughness. The glass pillar's glow should reflect in the floor's surface.

## The Pillar

A tall, narrow glass column (mesh: `pillar.obj`) standing upright at the center. Clear specular glass material with IOR ~1.5. Scaled tall and thin — a vertical beacon shape. Positioned at center, sitting on the floor.

## Lighting

A quad light embedded inside or just behind the pillar, providing the internal glow. Warm white emission, moderate-to-high power. The light refracts through the glass, creating caustic patterns on the floor. No other direct lights — the pillar IS the light source.

## Camera

Low angle, looking slightly up at the pillar. Positioned close enough to see detail in the glass refraction, far enough to see the floor reflections and starfield behind. Portrait orientation (1080x1920).

## The Look

A luminous glass beacon against deep space. The pillar glows from within, light refracting through its glass surfaces and casting intricate caustic patterns on the mirror floor below. Stars visible in the dark background. Moody, sci-fi atmosphere.

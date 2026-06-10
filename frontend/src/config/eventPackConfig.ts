import type { ComponentProps } from 'react';
import type BoosterPack3D from '../components/BoosterPack3D';

// Per-event 3D booster config (texture + mesh mapping). Extracted from the old
// Events storefront page (now removed) so the remaining consumers - the Profile
// daily Shiny pack and the Battle arena - keep working.
export const EVENT_PACK_CONFIG: Record<string, ComponentProps<typeof BoosterPack3D>> = {
  'Shiny Surge': {
    textureUrl: '/shiny_surge_pack.png',
    textureFlipY: true,
    textureMaterialName: null,
    textureMeshName: 'Object_4',
    transparentMeshName: 'Object_6',
  },
  'Édition Unys': {
    textureUrl: '/texture_pack_gen_5.png',
    textureFlipY: true,
    textureMaterialName: null,
    textureMeshName: 'Object_4',
    transparentMeshName: 'Object_6',
  },
};

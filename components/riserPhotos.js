// Photographs for the riser door choices, keyed by the option ids in
// data/christo-riser-door.json. Both the quick spec's tiles and the
// guided flow's choice cards read from here; a missing entry simply
// leaves the line drawing (guided) or plain tile (quick) in place.

export const RISER_PHOTOS = {
  wall: {
    "timber-stud": "/products/riser-wall-timber-stud.jpg",
    "steel-stud": "/products/riser-wall-steel-stud.jpg",
    "masonry": "/products/riser-wall-masonry.jpg",
    "shaftwall": "/products/riser-wall-shaftwall.jpg",
    "masonry-lined": "/products/riser-wall-masonry-lined.jpg",
  },
  frame: {
    "flush": "/products/riser-frame-flush.jpg",
    "picture": "/products/riser-frame-picture.jpg",
    "raised-picture": "/products/riser-frame-raised-picture.jpg",
  },
  lock: {
    "slik-plus-euro": "/products/riser-lock-slik-plus-euro.jpg",
    "slik-plus-thumb": "/products/riser-lock-slik-plus-thumb.jpg",
    "slik-euro": "/products/riser-lock-slik-euro.jpg",
    "slik-euro-thumb": "/products/riser-lock-slik-euro-thumb.jpg",
    "slik-concealed": "/products/riser-lock-slik-concealed.jpg",
  },
};

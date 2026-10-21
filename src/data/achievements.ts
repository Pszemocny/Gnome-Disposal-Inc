export interface Achievement {
  id: string;
  name: string;
  desc: string;
  secret?: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', name: 'Side Hustle', desc: 'Feed the hole your first gnome.' },
  { id: 'g100', name: 'Small Business', desc: 'Feed 100 gnomes.' },
  { id: 'g1000', name: 'Gnome Disposal Inc.', desc: 'Feed 1,000 gnomes.' },
  { id: 'g10000', name: 'Gnomocide', desc: 'Feed 10,000 gnomes.' },
  { id: 'combo15', name: 'Gnomazing', desc: 'Reach a 15 combo.' },
  { id: 'combo60', name: 'GNOMEGEDDON', desc: 'Reach a 60 combo.' },
  { id: 'combo100', name: 'Hole-y Moly', desc: 'Reach a 100 combo.' },
  { id: 'm1k', name: 'Pocket Money', desc: 'Earn $1k.' },
  { id: 'm1m', name: 'Gnomillionaire', desc: 'Earn $1m.' },
  { id: 'm1b', name: 'Gnome Baron', desc: 'Earn $100m.' },
  { id: 'hole5', name: 'It Grows', desc: 'Reach hole level 5.' },
  { id: 'hole10', name: 'It Hungers', desc: 'Reach hole level 10.' },
  { id: 'golden', name: 'Midas Touch', desc: 'Feed a golden gnome.' },
  { id: 'wizard', name: 'Magic Missile', desc: 'Feed a gnome wizard.' },
  { id: 'king', name: 'Regicide', desc: 'Feed the King Gnome.' },
  { id: 'ufo', name: 'Close Encounter', desc: 'Shoot down the UFO.' },
  { id: 'land', name: 'Landlord', desc: 'Buy all the land.' },
  { id: 'sniper', name: 'Gnome Sniper', desc: 'Score a SNIPER shot from 14 m.' },
  { id: 'bullseye', name: 'Dead Centre', desc: 'Throw a gnome through the golden hoop into the hole.' },
  { id: 'rebirth', name: 'Born Again', desc: 'Enter The Deep and come back.' },
  { id: 'chair', name: 'Comfy Abyss', desc: 'Feed the hole an armchair.', secret: true },
  { id: 'flamingo', name: 'Pink Sacrifice', desc: 'Feed the hole a flamingo.', secret: true },
  { id: 'shovel', name: 'Dig Deep', desc: 'Find the golden shovel.', secret: true },
  { id: 'booze', name: 'Properly Boozed', desc: 'Feed the hole the word GNOME.', secret: true },
  { id: 'fall', name: 'Curiosity', desc: 'Fall into the hole.', secret: true },
  { id: 'shadow', name: 'Stare Back', desc: 'Feed a shadow gnome.', secret: true },
];

// Quick reactions: tap a button, a speech bubble pops over your guy on the big screen.
export const REACTIONS = [
  { id: 'lol', text: 'LOL' },
  { id: 'omg', text: 'OMG' },
  { id: 'noo', text: 'NOOOO' },
  { id: 'gg', text: 'GG' },
  { id: 'clap', text: '*CLAP*' },
];
export const reactionText = (id) => (REACTIONS.find(r => r.id === id) || REACTIONS[0]).text;

// Quiz rounds. The host has the questions inside the step (step.questions, from the Quiz Shelf or an upload);
// phones and the projector get the current round's questions as state.q.
// Older packs can still point at a round in their own quiz.json with step.round.
import { mcqStation } from './mcq.js';

export default mcqStation({
  id: 'quiz', title: 'Quiz', seconds: 30,
  intro: 'Read the setup. Pick the answer.',
  getQuestions: (ctx) => ctx.step.questions || ctx.state.q || (ctx.content.rounds || {})[ctx.step.round] || [],
});

LEARNING.startGame({
  type: 'missingFactor',
  tasks() {
    const tasks = [];
    for (let factorA = 1; factorA <= 10; factorA++) {
      for (let answer = 1; answer <= 10; answer++) {
        const product = factorA * answer;
        tasks.push({
          id: `${factorA},${product}`,
          factorA,
          product,
          answer,
        });
      }
    }
    return tasks;
  },
  normalizeStat: stat => ({ ...stat, id: `${stat.factorA},${stat.product}` }),
  question: task => `${task.factorA} × _ = ${task.product}`,
  keys: task => [task.factorA, task.product],
});

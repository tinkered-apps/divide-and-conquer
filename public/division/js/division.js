LEARNING.startGame({
  type: 'division',
  tasks() {
    const tasks = [];
    for (let quotient = 1; quotient <= 10; quotient++) {
      for (let divisor = 1; divisor <= 10; divisor++) {
        const dividend = quotient * divisor;
        tasks.push({
          id: `${dividend},${divisor}`,
          dividend,
          divisor,
          answer: quotient,
        });
      }
    }
    return tasks;
  },
  normalizeStat: stat => ({ ...stat, id: `${stat.dividend},${stat.divisor}` }),
  question: task => `${task.dividend} ÷ ${task.divisor} = ?`,
  keys: task => [task.dividend, task.divisor],
});

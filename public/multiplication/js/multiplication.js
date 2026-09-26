LEARNING.startGame({
  type: 'multiplication',
  tasks() {
    const tasks = [];
    for (let a = 1; a <= 10; a++) {
      for (let b = a; b <= 10; b++) {
        tasks.push({ id: `${a},${b}`, a, b, answer: a * b });
      }
    }
    return tasks;
  },
  normalizeStat(stat) {
    const a = Math.min(stat.factorA, stat.factorB);
    const b = Math.max(stat.factorA, stat.factorB);
    return { ...stat, id: `${a},${b}` };
  },
  question(task) {
    const swap = task.a !== task.b && Math.random() < 0.5;
    return `${swap ? task.b : task.a} × ${swap ? task.a : task.b} = ?`;
  },
  keys: task => [task.a, task.b],
});

/**
 * Mission: contenedor de objetivos de un escenario (capacitacion, inspeccion, simulacro).
 *
 * Cada objetivo: { id, text, done }. La mision se completa cuando todos estan hechos.
 * Es deliberadamente simple: la logica de cuando se cumple cada objetivo la decide quien
 * la use (MissionManager escucha el EventBus). Punto de extension para flujos complejos:
 * ramificaciones, puntajes, tiempos, evaluacion de procedimientos (PETS).
 */
export class Mission {
  constructor({ id, title, objectives }) {
    this.id = id;
    this.title = title;
    this.objectives = objectives.map((o) => ({ done: false, ...o }));
  }

  complete(objectiveId) {
    const obj = this.objectives.find((o) => o.id === objectiveId);
    if (obj && !obj.done) {
      obj.done = true;
      return true;
    }
    return false;
  }

  get isComplete() {
    return this.objectives.every((o) => o.done);
  }

  get progress() {
    const done = this.objectives.filter((o) => o.done).length;
    return { done, total: this.objectives.length };
  }
}

import { Mission } from './Mission.js';

/**
 * MissionManager: gestiona la mision activa y marca objetivos en respuesta a eventos del
 * EventBus. Incluye una mision de induccion por defecto que recorre los elementos clave del
 * md (EPP, tablero de gestion, tablero electrico, refugio).
 *
 * Extension point: catalogo de misiones (inspecciones, investigacion de incidentes,
 * simulacros de emergencia), evaluacion y reportes.
 */
export class MissionManager {
  constructor({ bus }) {
    this.bus = bus;
    this.current = this._inductionMission();

    // Marca objetivos segun las interacciones del jugador (por etiqueta).
    this.bus.on('player:interact', ({ label } = {}) => {
      if (!label) return;
      if (label.includes('EPP')) this._mark('epp');
      if (label.includes('gestion')) this._mark('gestion');
      if (label.includes('electrico')) this._mark('tablero');
      if (label.includes('Refugio')) this._mark('refugio');
    });

    this.bus.emit('mission:started', { title: this.current.title, objectives: this.current.objectives });
  }

  _inductionMission() {
    return new Mission({
      id: 'induccion',
      title: 'Induccion de Seguridad — NV-1600',
      objectives: [
        { id: 'epp', text: 'Leer la senal de Uso Obligatorio de EPP' },
        { id: 'gestion', text: 'Revisar el tablero de gestion SSOMA/AESA' },
        { id: 'tablero', text: 'Inspeccionar un tablero electrico' },
        { id: 'refugio', text: 'Ubicar e ingresar al Refugio Minero' }
      ]
    });
  }

  _mark(objectiveId) {
    if (this.current.complete(objectiveId)) {
      this.bus.emit('mission:objectiveComplete', {
        id: objectiveId,
        progress: this.current.progress
      });
      if (this.current.isComplete) {
        this.bus.emit('ui:read', {
          title: 'INDUCCION COMPLETADA',
          body: 'Has completado el recorrido de induccion de seguridad. Conoces el EPP ' +
            'obligatorio, los tableros de gestion y electricos, y la ubicacion del refugio.'
        });
        this.bus.emit('mission:complete', { id: this.current.id });
      }
    }
  }

  // Reservado para logica temporal de misiones (timers de simulacro, etc.).
  update() {}
}

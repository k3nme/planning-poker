import type { Player, RoomState } from '../../types';
import type { RoomActions } from '../../lib/useRoom';

export type StageProps = {
  room: RoomState;
  you: Player | null;
  youId: string | null;
  isHost: boolean;
  actions: RoomActions;
};

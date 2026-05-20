import db from '../sqlite';

export interface TransferData {
    id: number;
    current_rank: number;
    current: string;
    destination: string;
    passport: string;
    user_id: string;
    nickname: string;
    current_approve: string;
    destination_approve: string;
    msg_id: string;
}


export const TransfersRepository = {

    pushTransfer(currentRank: number, currentFrac: string, targetFrac: string, passport: string, id: string, nickname: string, fromApprove: string, toApprove: string, msg_id: string) {
        db.prepare('INSERT OR REPLACE INTO transfers (current_rank, current, destination, user_id, passport, nickname, current_approve, destination_approve, msg_id) VALUES (?,?,?,?,?,?,?,?,?)')
            .run(currentRank, currentFrac, targetFrac, id, passport, nickname, fromApprove, toApprove, msg_id);
    },

    retrieveTransferData(passport: string): TransferData | undefined {
        return db.prepare(`SELECT * FROM transfers WHERE passport = ?`).get(passport) as TransferData | undefined
    },

    removeTransfer(passport: string) {
        db.prepare('DELETE FROM transfers WHERE passport = ?').run(passport);
    }
}
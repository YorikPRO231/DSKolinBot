import prisma from '../prisma.service';

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
  async pushTransfer(
    currentRank: number,
    currentFrac: string,
    targetFrac: string,
    passport: string,
    id: string,
    nickname: string,
    fromApprove: string,
    toApprove: string,
    msg_id: string
  ): Promise<void> {
    await prisma.transfer.upsert({
      where: { passport },
      update: {
        currentRank,
        current: currentFrac,
        destination: targetFrac,
        userId: id,
        nickname,
        currentApprove: fromApprove,
        destinationApprove: toApprove,
        msgId: msg_id,
      },
      create: {
        currentRank,
        current: currentFrac,
        destination: targetFrac,
        passport,
        userId: id,
        nickname,
        currentApprove: fromApprove,
        destinationApprove: toApprove,
        msgId: msg_id,
      },
    });
  },

  async retrieveTransferData(passport: string): Promise<TransferData | undefined> {
    const transfer = await prisma.transfer.findUnique({
      where: { passport },
    });

    if (!transfer) return undefined;

    return {
      id: transfer.id,
      current_rank: transfer.currentRank,
      current: transfer.current,
      destination: transfer.destination,
      passport: transfer.passport,
      user_id: transfer.userId,
      nickname: transfer.nickname,
      current_approve: transfer.currentApprove,
      destination_approve: transfer.destinationApprove,
      msg_id: transfer.msgId,
    };
  },

  async removeTransfer(passport: string): Promise<void> {
    await prisma.transfer.delete({
      where: { passport },
    }).catch(() => {});
  },
};
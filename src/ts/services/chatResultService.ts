import type { ActorId, RequestId, RollTypeId, UserId } from "../domain/ids";
import { askARollSocketProtocol } from "../socket/channel";

export type AskARollChatCorrelation = {
  readonly requestId: RequestId;
  readonly rollTypeId: RollTypeId;
  readonly actorId: ActorId;
  readonly gmUserId: UserId;
  readonly playerUserId: UserId;
  readonly protocol: typeof askARollSocketProtocol;
};

type ChatMessageFlagUpdater = {
  update(data: { readonly flags: { readonly askaroll: AskARollChatCorrelation } }): Promise<unknown>;
};

export function createAskARollChatFlags(
  correlation: Omit<AskARollChatCorrelation, "protocol">,
): { readonly flags: { readonly askaroll: AskARollChatCorrelation } } {
  return {
    flags: {
      askaroll: {
        ...correlation,
        protocol: askARollSocketProtocol,
      },
    },
  };
}

export class ChatResultService {
  async tagChatMessage(
    chatMessage: ChatMessage,
    correlation: Omit<AskARollChatCorrelation, "protocol">,
  ): Promise<void> {
    const writableMessage = chatMessage as unknown as ChatMessageFlagUpdater;
    await writableMessage.update(createAskARollChatFlags(correlation));
  }

  async tagChatMessages(
    chatMessageIds: readonly string[],
    correlation: Omit<AskARollChatCorrelation, "protocol">,
  ): Promise<void> {
    const messages = chatMessageIds.flatMap((id) => {
      const message = game.messages?.get(id) ?? null;
      return message == null ? [] : [message];
    });

    await Promise.all(
      messages.map((message) => this.tagChatMessage(message, correlation)),
    );
  }
}

export const chatResultService = new ChatResultService();

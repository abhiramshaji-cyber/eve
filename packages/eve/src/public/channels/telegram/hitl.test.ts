import { describe, expect, it } from "vitest";

import {
  TELEGRAM_CALLBACK_RESPONSE_PREFIX,
  TELEGRAM_REPLY_RESPONSE_PREFIX,
  isTelegramSyntheticResponse,
  registerTelegramFreeformPrompt,
  renderTelegramInteraction,
  resolveTelegramAnswers,
  telegramReplyAnswer,
  type TelegramHitlState,
} from "#public/channels/telegram/hitl.js";

describe("renderTelegramInteraction", () => {
  it("renders option requests as compact inline-keyboard callbacks", () => {
    const state: TelegramHitlState = {};
    const rendered = renderTelegramInteraction(
      {
        call: { callId: "call_1", input: {}, name: "ask_question" },
        request: {
          kind: "question",
          options: [
            { id: "approve", label: "Approve" },
            { id: "cancel", label: "Cancel" },
          ],
          prompt: "Approve?",
        },
        status: "open",
        turnId: "turn_0",
        stepIndex: 0,
        interactionId: "very-long-request-id-that-would-not-fit-comfortably-in-callback-data",
      },
      state,
    );

    expect(rendered.replyMarkup).toEqual({
      inline_keyboard: [
        [
          { callback_data: "eve:0", text: "Approve" },
          { callback_data: "eve:1", text: "Cancel" },
        ],
      ],
    });
    expect(Object.keys(state.hitlCallbacks ?? {})).toEqual(["eve:0", "eve:1"]);
    expect("eve:0".length).toBeLessThanOrEqual(64);
    expect(rendered.text).toBe("Approve?");
  });

  it("lists each option's full label and description under the prompt", () => {
    const warning = `${"A".repeat(90)} IMPORTANT: selecting this option *loses* <b>data</b>.`;
    const longLabel = `Keep ${"x".repeat(75)}`;
    const rendered = renderTelegramInteraction(
      {
        call: { callId: "call_1", input: {}, name: "ask_question" },
        request: {
          kind: "question",
          options: [
            { description: warning, id: "one", label: "Option one" },
            { id: "two", label: longLabel },
            { description: "No data is lost.", id: "three", label: "Option three" },
          ],
          prompt: "Choose an option",
        },
        status: "open",
        turnId: "turn_0",
        stepIndex: 0,
        interactionId: "call_1",
      },
      {},
    );
    const keyboard = (rendered.replyMarkup?.inline_keyboard ?? []) as { text: string }[][];

    expect(rendered.text).toBe(
      [
        "Choose an option",
        "",
        `• Option one: ${warning}`,
        `• ${longLabel}`,
        "• Option three: No data is lost.",
      ].join("\n"),
    );
    expect(keyboard.flat().map((button) => button.text.length <= 64)).toEqual([true, true, true]);
  });

  it("keeps option text within Telegram's message length", () => {
    const rendered = renderTelegramInteraction(
      {
        call: { callId: "call_1", input: {}, name: "ask_question" },
        request: {
          kind: "question",
          options: ["a", "b", "c"].map((id) => ({ description: "d".repeat(2000), id, label: id })),
          prompt: "Choose",
        },
        status: "open",
        turnId: "turn_0",
        stepIndex: 0,
        interactionId: "call_1",
      },
      {},
    );

    expect(rendered.text.length).toBeLessThanOrEqual(4000);
    expect(rendered.text.startsWith("Choose\n\n• a: ddd")).toBe(true);
  });

  it("renders freeform requests as ForceReply prompts", () => {
    const rendered = renderTelegramInteraction(
      {
        call: { callId: "call_1", input: {}, name: "ask_question" },
        request: { allowFreeform: true, kind: "question", prompt: "Explain" },
        status: "open",
        turnId: "turn_0",
        stepIndex: 0,
        interactionId: "call_1",
      },
      {},
    );

    expect(rendered).toMatchObject({
      freeformRequestId: "call_1",
      replyMarkup: { force_reply: true, selective: true },
      text: "Explain",
    });
  });
});

describe("resolveTelegramAnswers", () => {
  it("maps replies to ForceReply prompts back to freeform answers", () => {
    const state: TelegramHitlState = {};
    registerTelegramFreeformPrompt(state, { messageId: "99", requestId: "call_1" });

    expect(
      resolveTelegramAnswers(state, [telegramReplyAnswer({ messageId: "99", text: "approved" })]),
    ).toEqual([{ interactionId: "call_1", text: "approved" }]);
    expect(state.pendingFreeformReplies).toEqual({});
  });

  it("skips stale synthetic responses and preserves normal responses", () => {
    const staleCallback = {
      optionId: "selected",
      interactionId: `${TELEGRAM_CALLBACK_RESPONSE_PREFIX}eve:old`,
    };
    const staleReply = {
      interactionId: `${TELEGRAM_REPLY_RESPONSE_PREFIX}99`,
      text: "ignored",
    };
    const normal = { interactionId: "direct", optionId: "ok" };

    expect(resolveTelegramAnswers({}, [staleCallback, staleReply, normal])).toEqual([normal]);
    expect(isTelegramSyntheticResponse(staleCallback)).toBe(true);
    expect(isTelegramSyntheticResponse(normal)).toBe(false);
  });
});

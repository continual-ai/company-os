"use client"

import { FileTextIcon, PaperclipIcon, SendIcon, XIcon } from "lucide-react"
import * as React from "react"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  type AttachmentState,
} from "#/ui/components/attachment.tsx"
import { Bubble, BubbleContent } from "#/ui/components/bubble.tsx"
import { Button } from "#/ui/components/button.tsx"
import { Card } from "#/ui/components/card.tsx"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "#/ui/components/input-group.tsx"
import { Marker, MarkerContent, MarkerIcon } from "#/ui/components/marker.tsx"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "#/ui/components/message-scroller.tsx"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "#/ui/components/message.tsx"
import { Spinner } from "#/ui/components/spinner.tsx"
import { cn } from "#/ui/lib/utils.ts"

interface ChatAttachment {
  id: string
  name: string
  description?: string
  url?: string
  status?: AttachmentState
}

interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  attachments?: ChatAttachment[]
  status?: "queued" | "streaming" | "complete" | "error"
}

function ChatAttachmentRow({
  attachments,
  onRemove,
}: {
  attachments: ChatAttachment[]
  onRemove?: (attachment: ChatAttachment) => void
}) {
  if (attachments.length === 0) return null

  return (
    <AttachmentGroup>
      {attachments.map((attachment) => (
        <Attachment
          key={attachment.id}
          state={attachment.status ?? "done"}
          size="sm"
        >
          <AttachmentMedia>
            <FileTextIcon className="size-4" />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{attachment.name}</AttachmentTitle>
            {attachment.description !== undefined && (
              <AttachmentDescription>
                {attachment.description}
              </AttachmentDescription>
            )}
          </AttachmentContent>
          {onRemove && (
            <AttachmentActions>
              <AttachmentAction
                aria-label={`Remove ${attachment.name}`}
                onClick={() => onRemove(attachment)}
              >
                <XIcon className="size-3" />
              </AttachmentAction>
            </AttachmentActions>
          )}
        </Attachment>
      ))}
    </AttachmentGroup>
  )
}

function ChatStatusMarker({
  children = "Generating response...",
}: {
  children?: string
}) {
  return (
    <Marker>
      <MarkerIcon>
        <Spinner />
      </MarkerIcon>
      <MarkerContent className="animate-pulse">{children}</MarkerContent>
    </Marker>
  )
}

/**
 * Scroll-anchored transcript. A streaming message becomes the scroll anchor
 * so the viewport pins its start to the reading line while it grows.
 */
function ChatMessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <MessageScrollerProvider>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent className="p-4">
            {messages.map((message) => {
              const isUser = message.role === "user"
              return (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.status === "streaming"}
                >
                  {message.role === "system" ? (
                    <ChatStatusMarker>{message.content}</ChatStatusMarker>
                  ) : (
                    <Message align={isUser ? "end" : "start"}>
                      {!isUser && <MessageAvatar>AI</MessageAvatar>}
                      <MessageContent>
                        <MessageHeader>
                          {isUser ? "You" : "Assistant"}
                        </MessageHeader>
                        <Bubble
                          variant={isUser ? "default" : "secondary"}
                          align={isUser ? "end" : "start"}
                        >
                          <BubbleContent>{message.content}</BubbleContent>
                        </Bubble>
                        {message.attachments && (
                          <ChatAttachmentRow
                            attachments={message.attachments}
                          />
                        )}
                        {message.status === "streaming" && (
                          <MessageFooter>Streaming</MessageFooter>
                        )}
                      </MessageContent>
                    </Message>
                  )}
                </MessageScrollerItem>
              )
            })}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

/**
 * Draft input for the conversation. Submission is suppressed while `disabled`
 * or when the draft is blank.
 */
function ChatPromptComposer({
  value,
  onValueChange,
  onSubmit,
  disabled,
  attachments,
  onAttach,
}: {
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean | undefined
  attachments?: React.ReactNode
  onAttach?: () => void
}) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!value.trim() || disabled) return
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="border-t bg-background p-3">
      {attachments}
      <InputGroup>
        <InputGroupTextarea
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder="Ask anything..."
          disabled={disabled}
          rows={2}
        />
        {onAttach && (
          <InputGroupAddon align="inline-start">
            <InputGroupButton
              type="button"
              aria-label="Attach file"
              onClick={onAttach}
            >
              <PaperclipIcon className="size-4" />
            </InputGroupButton>
          </InputGroupAddon>
        )}
        <InputGroupAddon align="inline-end">
          <Button
            type="submit"
            size="icon-sm"
            disabled={disabled || !value.trim()}
            aria-label="Send message"
          >
            <SendIcon className="size-4" />
          </Button>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}

function ChatShell({
  className,
  messages,
  value,
  onValueChange,
  onSubmit,
  disabled,
}: {
  className?: string
  messages: ChatMessage[]
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
}) {
  return (
    <Card
      className={cn(
        "h-[min(680px,calc(100dvh-8rem))] overflow-hidden p-0",
        className
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatMessageList messages={messages} />
        <ChatPromptComposer
          value={value}
          onValueChange={onValueChange}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      </div>
    </Card>
  )
}

export {
  ChatAttachmentRow,
  ChatMessageList,
  ChatPromptComposer,
  ChatShell,
  ChatStatusMarker,
  type ChatAttachment,
  type ChatMessage,
}

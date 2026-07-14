# Feature Specification: Real-Time Chat & Video Calling

**Feature Branch**: `001-realtime-chat-video`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Build a real-time chat and video calling application modeled on Discord."

## Clarifications

### Session 2026-07-14

- Q: When a member already in a call joins another call, what happens? → A: One call at a time — joining a new voice channel or DM call disconnects the user from their current call.
- Q: Are per-channel/per-DM unread indicators or new-message notifications in scope for v1? → A: Out of scope for v1.
- Q: What maximum length should a single text/DM message allow? → A: 2000 characters.
- Q: When a member leaves or is removed from a server, what happens to messages they already posted? → A: Messages remain, still attributed to the (former) member.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accounts, Identity & Presence (Priority: P1)

A visitor creates an account and logs in. They set a display name and avatar. Once
logged in, other users can see whether they are currently online or offline.

**Why this priority**: Nothing else in the product is usable without an identity. Every
other story assumes an authenticated user with a display name, avatar, and a
visible presence state.

**Independent Test**: Register two accounts, set distinct display names and avatars, log
in on two sessions, and confirm each session sees the other transition between online and
offline as they connect and disconnect.

**Acceptance Scenarios**:

1. **Given** a visitor with no account, **When** they sign up with valid credentials, a
   display name, and an avatar, **Then** an account is created and they are logged in.
2. **Given** a registered user, **When** they log in with correct credentials, **Then**
   they gain access to the application; with incorrect credentials they are rejected.
3. **Given** a logged-in user, **When** they are connected and active, **Then** other
   users see their status as online.
4. **Given** a user who was online, **When** they disconnect or log out, **Then** other
   users see their status change to offline within a few seconds without refreshing.
5. **Given** a visitor who is not logged in, **When** they attempt to access any protected
   feature (a server, channel, message view, DM, or call), **Then** access is denied and
   they are directed to log in.

---

### User Story 2 - Servers & Membership (Priority: P1)

A logged-in user creates a named server (with an optional image) and becomes its owner.
The owner generates an invite link and shares it; other users use the link to join. The
server shows a sidebar of its members and each member's online status. The owner can
rename the server and remove members.

**Why this priority**: Servers are the primary container for channels, messages, and
calls. Without a server and its membership, there is no shared space in which to
communicate.

**Independent Test**: Create a server as User A, generate an invite link, join as User B
via that link, confirm both appear in the member sidebar with correct online status, then
rename the server and remove User B as the owner and confirm User B loses access.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they create a server with a name (and optional
   image), **Then** the server is created and they are recorded as its owner.
2. **Given** a server owner, **When** they generate an invite link, **Then** a shareable
   link is produced that lets other logged-in users join the server.
3. **Given** a logged-in user with a valid invite link, **When** they use it, **Then**
   they become a member and appear in the server's member sidebar.
4. **Given** a server member viewing the sidebar, **When** another member's online status
   changes, **Then** the sidebar reflects the new status without a refresh.
5. **Given** a server owner, **When** they rename the server, **Then** all members see the
   new name without a refresh.
6. **Given** a server owner, **When** they remove a member, **Then** that member loses
   access to the server and its channels.
7. **Given** a non-owner member, **When** they attempt to rename the server or remove a
   member, **Then** the action is rejected.
8. **Given** a member who has posted messages and then leaves or is removed, **When** other
   members view the channel history, **Then** that member's earlier messages remain visible
   and attributed to them.

---

### User Story 3 - Real-Time Text Messaging (Priority: P1)

Inside a text channel, members send text messages that appear for all members in real
time without refreshing. Each message shows the author's name and avatar, a timestamp,
and its content. Authors can edit and delete their own messages, and edited messages are
marked as edited. History loads newest-first with infinite scroll. A typing indicator
shows when someone is composing a message.

**Why this priority**: Real-time text messaging is the core value of the product and the
primary reason members join a server. Every server is created with a default "general"
text channel, so this story is exercisable as soon as servers exist.

**Independent Test**: With two members in a server's "general" channel, send a message from
one and confirm it appears instantly for the other; edit and delete it and confirm both
sessions update; scroll up to load older history; and confirm a typing indicator appears
for the other member while one is composing.

**Acceptance Scenarios**:

1. **Given** a member in a text channel, **When** they send a message, **Then** it appears
   for all members of that channel in real time without a refresh.
2. **Given** a displayed message, **When** it is viewed, **Then** it shows the author's
   display name, avatar, a timestamp, and the message content.
3. **Given** a message authored by the current user, **When** they edit it, **Then** the
   updated content appears for all members and the message is marked as edited.
4. **Given** a message authored by the current user, **When** they delete it, **Then** it
   is removed for all members in real time.
5. **Given** a member, **When** they attempt to edit or delete a message they did not
   author, **Then** the action is rejected.
6. **Given** a channel with more history than fits on screen, **When** the member scrolls
   toward the oldest visible message, **Then** older messages load automatically
   (newest-first ordering, infinite scroll).
7. **Given** a member composing a message, **When** they are typing, **Then** other members
   of the channel see a typing indicator for that member, which clears when they stop.
8. **Given** a member composing a message, **When** the content exceeds 2000 characters,
   **Then** the message is not sent and the member is informed of the limit.

---

### User Story 4 - Channel Management (Priority: P2)

Every server starts with a default "general" text channel. All members can see every
channel. The owner can create, rename, and delete both text channels and voice channels.
Deleting a channel removes its messages.

**Why this priority**: The default "general" channel makes messaging (US3) possible on its
own, so full channel management is valuable but not required for an initial usable slice.
It extends a server beyond a single channel.

**Independent Test**: As an owner, create a new text channel and a new voice channel,
rename each, confirm all members see the changes without refreshing, then delete the text
channel and confirm its messages are gone for everyone.

**Acceptance Scenarios**:

1. **Given** a newly created server, **When** it is created, **Then** it contains a default
   text channel named "general".
2. **Given** a server member, **When** they view the server, **Then** they can see all of
   its channels.
3. **Given** a server owner, **When** they create a text or voice channel, **Then** the new
   channel appears for all members without a refresh.
4. **Given** a server owner, **When** they rename a channel, **Then** all members see the
   new name without a refresh.
5. **Given** a server owner, **When** they delete a channel, **Then** the channel and all of
   its messages are removed for all members.
6. **Given** a non-owner member, **When** they attempt to create, rename, or delete a
   channel, **Then** the action is rejected.

---

### User Story 5 - Direct Messages (Priority: P2)

Any user can open a 1-on-1 direct message (DM) conversation with another user who shares at
least one server with them. DMs behave like channels: messages are delivered in real time,
authors can edit and delete their own messages, and a typing indicator shows when the other
participant is composing. An unread-message badge shows on each DM and as a total on the
home icon until the conversation is opened (FR-023a — see note below).

> **Post-v1 scope addition**: Unread DM badges were originally deferred (see the v1
> Out-of-Scope list) but were added during implementation at the user's request. This is
> tracked here as FR-023a / US5 #7 rather than a fresh clarification round, since it's a
> small, additive change with no impact on the rest of the spec.

**Why this priority**: DMs add private communication alongside server channels. They build
on the messaging capability from US3 and are valuable but not part of the core server-chat
slice.

**Independent Test**: With two users who share a server, open a DM from one to the other,
exchange messages in real time, confirm edit and delete behave as they do in channels, and
confirm a typing indicator appears while the other participant is composing.

**Acceptance Scenarios**:

1. **Given** two users who share at least one server, **When** one opens a DM with the
   other, **Then** a 1-on-1 conversation is available to both.
2. **Given** an open DM, **When** one participant sends a message, **Then** it appears for
   the other in real time without a refresh.
3. **Given** a DM message authored by the current user, **When** they edit or delete it,
   **Then** the change is reflected for both participants and edits are marked.
4. **Given** two users who share no server, **When** one attempts to open a DM with the
   other, **Then** the action is not available.
5. **Given** a user who already has a DM conversation with another user, **When** they open
   a DM with that same user again, **Then** the existing conversation is reopened rather
   than a second, duplicate conversation being created.
6. **Given** a participant composing a message in a DM, **When** they are typing, **Then** the
   other participant sees a typing indicator, which clears when they stop.
7. **Given** a user receives DM messages while not viewing that conversation, **When** they
   look at the DM list, **Then** the conversation shows an unread count, and a total appears
   on the home icon; **When** they open the conversation, **Then** both clear.

---

### User Story 6 - Voice & Video Calls in Voice Channels (Priority: P2)

A member joins a voice channel, which starts or joins a live call with the other members
currently connected to that channel (at least 2, target up to 4 participants). Participants
can toggle their microphone and camera, see each other's video tiles, see who is speaking
and who is muted, and leave the call. The channel list shows who is currently connected to
each voice channel.

**Why this priority**: Live voice/video is a headline capability but depends on servers and
channels being in place first. It is a distinct, high-value slice delivered after core text
communication.

**Independent Test**: With two members in a server, have both join the same voice channel,
confirm each sees the other's video tile and connected state, toggle mic and camera and
confirm the other sees muted/speaking changes, confirm the channel list shows both as
connected, and have one leave and confirm the other sees them drop off.

**Acceptance Scenarios**:

1. **Given** a member viewing a voice channel with no active call, **When** they join,
   **Then** a live call starts with them as the sole participant.
2. **Given** a voice channel with an active call, **When** another member joins, **Then**
   they enter the same call and all participants see each other (up to the supported
   maximum).
3. **Given** a participant in a call, **When** they toggle their microphone or camera,
   **Then** other participants see the updated muted/video state and the corresponding
   video tile appears or disappears.
4. **Given** an active call, **When** a participant is speaking, **Then** other participants
   can see who is currently speaking.
5. **Given** a participant in a call, **When** they leave, **Then** they are removed from
   the call and other participants and the channel list reflect their departure.
6. **Given** any member viewing the channel list, **When** members are connected to a voice
   channel, **Then** the list shows who is currently connected to that channel.
7. **Given** a participant in an active call, **When** they disconnect unexpectedly (e.g.,
   they lose their network connection or close the app without leaving), **Then** they are
   treated as having left the call and the remaining participants and the channel list
   reflect their departure.
8. **Given** a user already connected to a call, **When** they join a different voice channel
   or start/join a DM call, **Then** they are disconnected from the previous call (with its
   participants and connected-members list updated) and connected to the new one.

---

### User Story 7 - 1-on-1 Video Calls from a DM (Priority: P3)

From within a direct message conversation, a user can start a 1-on-1 video call with the
other participant, with the same in-call controls as a voice-channel call.

**Why this priority**: This reuses the calling capability from US6 in the DM context. It is
a valuable convenience but the last slice to deliver, as it depends on both DMs (US5) and
calls (US6).

**Independent Test**: In an open DM between two users, start a video call from one, have the
other join, confirm both see each other's video and can toggle mic/camera and leave.

**Acceptance Scenarios**:

1. **Given** an open DM conversation, **When** one participant starts a video call, **Then**
   the other participant can join a 1-on-1 call.
2. **Given** an active DM call, **When** a participant toggles mic or camera, **Then** the
   other participant sees the updated state.
3. **Given** an active DM call, **When** a participant leaves, **Then** the call ends for
   that participant and the other is notified.

---

### Edge Cases

- **Invalid or revoked invite link**: A user following an expired, malformed, or
  regenerated (old) invite link is told the link is not valid and does not join.
- **Removed member with the app open**: A member removed by the owner while actively viewing
  the server loses access to its channels, messages, and calls promptly.
- **Owner removal / last member**: Behavior when an owner attempts to leave or when the last
  member of a server departs (see Assumptions — owners cannot be removed; owner deletes the
  server to disband it).
- **Editing or deleting an already-deleted message**: Acting on a message that another action
  has already removed fails gracefully without error state for the user.
- **Voice channel at capacity**: A member attempting to join a voice channel that already has
  the maximum number of participants is prevented from joining and told the channel is full.
- **Media permission denied**: A participant who denies microphone/camera access can still
  join the call (e.g., listen only) rather than being blocked entirely.
- **Duplicate DM**: Opening a DM with someone an existing DM already exists with reuses the
  existing conversation rather than creating a second one.
- **Concurrent edits to server/channel state**: Simultaneous owner actions (e.g., renaming
  and deleting the same channel) resolve to a single consistent final state for all members.
- **Sudden disconnect during a call**: A participant who loses their connection is treated as
  having left the call for the remaining participants.

## Requirements *(mandatory)*

### Functional Requirements

#### Accounts, Identity & Presence

- **FR-001**: System MUST allow a visitor to create an account and MUST allow a registered
  user to log in and log out.
- **FR-002**: Each user MUST have a display name and an avatar, set during or after sign-up.
- **FR-003**: System MUST expose each user's online/offline presence to other users and MUST
  update it in real time as users connect and disconnect.
- **FR-004**: System MUST restrict all application functionality (servers, channels,
  messages, DMs, calls) to authenticated users.

#### Servers & Membership

- **FR-005**: System MUST allow a logged-in user to create a server with a name and an
  optional image, and MUST record the creator as the server's owner.
- **FR-006**: System MUST allow a server owner to generate an invite link that other
  logged-in users can use to join the server.
- **FR-007**: System MUST add a user to a server's membership when they join via a valid
  invite link, and MUST reject invalid, malformed, or revoked links.
- **FR-008**: System MUST display a server's members and each member's online status in a
  sidebar, updated in real time.
- **FR-009**: System MUST allow a server owner (and only the owner) to rename the server and
  to remove members.
- **FR-010**: System MUST immediately revoke a removed member's access to the server's
  channels, messages, and calls.
- **FR-010a**: System MUST retain messages previously posted by a member who leaves or is
  removed from a server, keeping them attributed to that (former) member; only deleting the
  channel (FR-014) removes them.

#### Channels

- **FR-011**: System MUST create a default text channel named "general" for every new
  server.
- **FR-012**: System MUST allow all members of a server to see all of its channels.
- **FR-013**: System MUST allow a server owner (and only the owner) to create, rename, and
  delete text channels and voice channels.
- **FR-014**: System MUST delete all messages belonging to a channel when that channel is
  deleted.
- **FR-015**: System MUST reflect channel creation, rename, and deletion to all members in
  real time.

#### Messaging

- **FR-016**: System MUST allow a channel member to send a text message that is delivered to
  all members of that channel in real time without a manual refresh.
- **FR-016a**: System MUST limit a single message (channel or DM) to a maximum of 2000
  characters and MUST reject or prevent sending messages that exceed this limit.
- **FR-017**: System MUST display, for each message, the author's display name, avatar, a
  timestamp, and the message content.
- **FR-018**: System MUST allow a message's author (and only the author) to edit and delete
  their own messages, and MUST visibly mark edited messages as edited.
- **FR-019**: System MUST load message history newest-first and MUST load older messages
  automatically as the member scrolls back (infinite scroll).
- **FR-020**: System MUST show a typing indicator to other channel members while a member is
  composing a message, and MUST clear it when they stop.

#### Direct Messages

- **FR-021**: System MUST allow a user to open a 1-on-1 DM conversation with another user
  with whom they share at least one server, and MUST prevent DMs between users who share no
  server.
- **FR-022**: System MUST deliver DM messages in real time and MUST support edit and delete
  of own messages with the same rules as channel messages (FR-016 through FR-018).
- **FR-022a**: System MUST show a typing indicator to the other participant of a DM while a
  participant is composing a message, and MUST clear it when they stop (the same behavior as
  channel typing indicators, FR-020).
- **FR-023**: System MUST reuse an existing DM conversation between two users rather than
  creating a duplicate.
- **FR-023a** *(post-v1 addition)*: System MUST show an unread-message count on each DM
  conversation in the DM list, and a combined total on the home icon, for messages received
  from the other participant since the conversation was last opened; opening the conversation
  MUST clear its count (and the total updates accordingly). A user's own messages MUST NOT
  count as unread for themselves.

#### Voice & Video Calls

- **FR-024**: System MUST allow a member to join a voice channel, starting a live call if
  none is active or joining the existing call for that channel.
- **FR-025**: System MUST support at least 2 and target up to 4 concurrent participants in a
  voice-channel call, and MUST prevent joining a channel that is already at capacity.
- **FR-026**: System MUST allow each participant to toggle their microphone and camera during
  a call.
- **FR-027**: System MUST show participants each other's video tiles and MUST indicate who is
  currently speaking and who is muted.
- **FR-028**: System MUST allow a participant to leave a call and MUST reflect their
  departure to remaining participants.
- **FR-029**: System MUST show, in the channel list, who is currently connected to each voice
  channel, updated in real time.
- **FR-030**: System MUST allow a 1-on-1 video call to be started from a DM conversation,
  with the same in-call controls as a voice-channel call.
- **FR-031**: System MUST treat a participant who disconnects unexpectedly as having left the
  call.
- **FR-032**: System MUST allow a user to be connected to at most one call at a time. When a
  user who is already in a call (voice channel or DM) joins or starts another, the system
  MUST disconnect them from the previous call before connecting them to the new one, and MUST
  reflect the departure to the previous call's participants and connected-members list.

### Key Entities *(include if feature involves data)*

- **User**: A person with an account. Key attributes: credentials/identity, display name,
  avatar, presence (online/offline). Participates in servers, authors messages, and joins
  calls.
- **Server**: A named community with an optional image and exactly one owner (a User).
  Contains channels and has a set of member Users. Associated with invite links.
- **Membership**: The association of a User with a Server (member or owner). Determines
  access to the server's channels, messages, and calls.
- **Invite Link**: A shareable token that lets a logged-in user join a specific Server; can
  be valid or revoked.
- **Channel**: A communication space within a Server; typed as text or voice. Text channels
  hold messages; voice channels host calls. One default "general" text channel per server.
- **Message**: A text entry authored by a User in a text Channel or a DM Conversation. Key
  attributes: author, content (max 2000 characters), timestamp, edited indicator. Persists
  independently of the author's current server membership.
- **DM Conversation**: A 1-on-1 messaging space between two Users who share a server; holds
  messages and supports typing indicators like a channel. Tracks each participant's
  last-read time to compute their unread count (FR-023a).
- **Call**: A live voice/video session associated with a voice Channel or a DM Conversation.
  Has a set of connected participant Users, each with mic and camera state and a
  speaking/muted indicator.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can go from the sign-up screen to sending their first message in a
  server (create account, create or join a server, send a message) in under 3 minutes.
- **SC-002**: A sent text message appears for other members of the channel within 1 second
  under normal conditions, without any manual refresh.
- **SC-003**: A user's online/offline status change is visible to others within 5 seconds of
  connecting or disconnecting.
- **SC-004**: A typing indicator appears to other members within 1 second of a member
  beginning to type and clears within a few seconds of them stopping.
- **SC-005**: In a voice channel call with up to 4 participants, each participant can see the
  others' video tiles and speaking/muted state, with mic/camera toggles reflected to others
  within 2 seconds.
- **SC-006**: Scrolling back through a channel with hundreds of historical messages loads
  the next batch of older messages within 1 second after the user reaches the top of the
  loaded history, without the user having to reload the page.
- **SC-007**: 95% of first-time users successfully create or join a server and send a message
  on their first attempt without external help.
- **SC-008**: Unauthorized actions (non-owner attempting owner-only actions, non-author
  editing a message, DM with a non-shared user) are prevented 100% of the time.

## Assumptions

- **Presence model**: "Online" means the user has an active, connected session; "offline"
  means no active session. A short grace period after disconnect before showing offline is
  acceptable.
- **Invite links**: A server has a reusable invite link that the owner can regenerate;
  regenerating invalidates the previous link. Links do not require per-user approval to join.
  No fixed expiration is assumed for v1.
- **Ownership**: Each server has exactly one owner who cannot be removed by others. Ownership
  transfer is out of scope for v1; an owner disbands a server by deleting it.
- **DM eligibility**: Sharing at least one server is the sole prerequisite for opening a DM;
  if all shared servers are later left, existing DMs remain accessible.
- **Call capacity**: Voice-channel calls support a minimum of 2 and target a maximum of 4
  participants; the enforced maximum is 4 for v1.
- **Media permissions**: Users may join calls without granting camera/microphone access and
  participate in a limited (e.g., listen-only) capacity.
- **Single active call**: A user can be connected to only one call at a time; joining a new
  call disconnects them from the previous one.
- **Message length**: A single message (channel or DM) is capped at 2000 characters.
- **Message retention on departure**: Messages authored by a member persist when that member
  leaves or is removed from a server, remaining attributed to them.
- **Message ordering**: Messages are ordered by server-assigned time; "newest-first" refers
  to load/pagination order while the channel view presents messages in reading order.
- **Platform**: A web application accessed on modern desktop browsers is assumed for v1
  (mobile apps are explicitly out of scope).
- **Standard practices**: Industry-standard defaults apply for credential handling, error
  messaging, and data retention unless otherwise specified.

## Out of Scope (v1)

- Message attachments and file uploads
- Message reactions
- Threads / threaded replies
- Roles and permissions beyond owner vs. member
- Screen sharing
- Native mobile applications
- Message search
- Channel unread indicators / new-message notifications (per-user read-state tracking is
  only implemented for DMs — FR-023a — not channels; adding it there would need per-channel
  read state, deferred to keep this addition small)

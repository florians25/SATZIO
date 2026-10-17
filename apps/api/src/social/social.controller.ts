import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  friendCodeSchema,
  friendRequestSchema,
  inviteCreateSchema,
  inviteLinkSchema,
  inviteRespondSchema,
  inviteUpdateSchema,
  joinRequestDecisionSchema,
  type FriendRequestInput,
  type InviteCreateInput,
  type InviteLinkInput,
  type InviteRespondInput,
  type InviteUpdateInput,
  type JoinRequestDecisionInput,
} from '@satzio/shared';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { ApiZodBody } from '../common/swagger';
import { ZodPipe } from '../common/zod.pipe';
import { FriendsService } from './friends.service';
import { InvitesService } from './invites.service';

const codePipe = new ZodPipe(friendCodeSchema);
const tokenPipe = new ZodPipe(friendCodeSchema);

@ApiTags('Social')
@ApiBearerAuth()
@Controller('friends')
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  @ApiOperation({ summary: 'Freunde, eingehende und ausgehende Anfragen (Aktivität nur, wenn der Freund sie teilt)' })
  overview(@CurrentUser() user: AuthUser) {
    return this.friends.overview(user.id);
  }

  @Get('search')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiQuery({ name: 'username', required: true })
  @ApiOperation({ summary: 'Nutzer per exaktem Benutzernamen finden (keine Teiltreffer)' })
  search(@CurrentUser() user: AuthUser, @Query('username') username = '') {
    return this.friends.search(user.id, String(username));
  }

  @Post('requests')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiZodBody(friendRequestSchema)
  @ApiOperation({ summary: 'Freundschaftsanfrage senden (Benutzername oder persönlicher Einladungscode)' })
  request(@CurrentUser() user: AuthUser, @Body(new ZodPipe(friendRequestSchema)) body: FriendRequestInput) {
    return this.friends.request(user.id, body);
  }

  @Post('requests/:id/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Eingehende Anfrage annehmen' })
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.accept(user.id, id);
  }

  @Post('requests/:id/decline')
  @HttpCode(200)
  @ApiOperation({ summary: 'Eingehende Anfrage ablehnen (Absender wird nicht benachrichtigt)' })
  decline(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.decline(user.id, id);
  }

  @Delete('requests/:id')
  @ApiOperation({ summary: 'Eigene Anfrage zurückziehen' })
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.cancel(user.id, id);
  }

  @Get('code')
  @ApiOperation({ summary: 'Persönlicher Einladungscode/-link' })
  code(@CurrentUser() user: AuthUser) {
    return this.friends.getCode(user.id);
  }

  @Post('code/regenerate')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Neuen Einladungscode erzeugen (alter Link wird ungültig)' })
  regenerate(@CurrentUser() user: AuthUser) {
    return this.friends.regenerateCode(user.id);
  }

  @Get('code/:code')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Vorschau: wem gehört dieser Einladungscode?' })
  previewCode(@CurrentUser() user: AuthUser, @Param('code', codePipe) code: string) {
    return this.friends.previewCode(user.id, code);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Freund entfernen' })
  remove(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.friends.remove(user.id, userId);
  }
}

@ApiTags('Social')
@ApiBearerAuth()
@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get()
  @ApiOperation({ summary: 'Eigene Einladungen (kommende und der letzten 30 Tage)' })
  list(@CurrentUser() user: AuthUser) {
    return this.invites.list(user.id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiZodBody(inviteCreateSchema)
  @ApiOperation({ summary: 'Gemeinsames Training planen und Freunde einladen' })
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(inviteCreateSchema)) body: InviteCreateInput) {
    return this.invites.create(user.id, body);
  }

  @Get('join/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Vorschau über Teilen-Link (Titel, Zeit, Gastgeber)' })
  joinPreview(@CurrentUser() user: AuthUser, @Param('token', tokenPipe) token: string) {
    return this.invites.joinPreview(user.id, token);
  }

  @Post('join/:token')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Teilnahme anfragen (Gastgeber bestätigt)' })
  join(@CurrentUser() user: AuthUser, @Param('token', tokenPipe) token: string) {
    return this.invites.join(user.id, token);
  }

  @Get('for-session/:sessionId')
  @ApiOperation({ summary: 'Einladung zu einem eigenen, verknüpften Training' })
  forSession(@CurrentUser() user: AuthUser, @Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.invites.forSession(user.id, sessionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Details inkl. Teilnehmerstatus (nur Gastgeber und Eingeladene)' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.invites.get(user.id, id);
  }

  @Patch(':id')
  @ApiZodBody(inviteUpdateSchema)
  @ApiOperation({ summary: 'Einladung ändern / weitere Freunde einladen (nur Gastgeber)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(inviteUpdateSchema)) body: InviteUpdateInput,
  ) {
    return this.invites.update(user.id, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Einladung absagen (nur Gastgeber)' })
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.invites.cancel(user.id, id);
  }

  @Post(':id/respond')
  @HttpCode(200)
  @ApiZodBody(inviteRespondSchema)
  @ApiOperation({ summary: 'Zusagen, absagen oder „vielleicht“' })
  respond(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(inviteRespondSchema)) body: InviteRespondInput,
  ) {
    return this.invites.respond(user.id, id, body.status);
  }

  @Post(':id/link')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiZodBody(inviteLinkSchema)
  @ApiOperation({ summary: 'Eigenes Training verknüpfen (404 SESSION_NOT_SYNCED, bis es synchronisiert ist)' })
  link(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(inviteLinkSchema)) body: InviteLinkInput,
  ) {
    return this.invites.link(user.id, id, body.sessionId);
  }

  @Get(':id/live')
  @ApiOperation({ summary: 'Live-Fortschritt der Gruppe (nur zugesagte Teilnehmende, minimale Daten)' })
  live(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.invites.live(user.id, id);
  }

  @Post(':id/requests/:userId')
  @HttpCode(200)
  @ApiZodBody(joinRequestDecisionSchema)
  @ApiOperation({ summary: 'Beitrittsanfrage bestätigen oder ablehnen (nur Gastgeber)' })
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodPipe(joinRequestDecisionSchema)) body: JoinRequestDecisionInput,
  ) {
    return this.invites.decideJoin(user.id, id, userId, body.approve);
  }
}

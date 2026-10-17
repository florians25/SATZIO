import { Module } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { InvitesService } from './invites.service';
import { FriendsController, InvitesController } from './social.controller';

/** Freunde & gemeinsames Training (Einladungen, Live-Gruppenansicht). */
@Module({
  controllers: [FriendsController, InvitesController],
  providers: [FriendsService, InvitesService],
  exports: [FriendsService, InvitesService],
})
export class SocialModule {}

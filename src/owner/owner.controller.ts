import { Controller, Get, Render, Res } from '@nestjs/common';

@Controller()
export class OwnerController {
  @Get()
  root(@Res() res: any) {
    return res.redirect('/owner/login');
  }

  @Get('favicon.ico')
  favicon(@Res() res: any) {
    return res.status(204).end();
  }
  @Get()
  @Render('owner/main')
  main() {
    return { frontendUrl: process.env.PAGE_URL };
  }
}

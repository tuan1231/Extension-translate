import { Command } from 'commander';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const program = new Command();

program
  .name('polyglot-worker')
  .description('Polyglot media ingest worker (GitHub Actions & Local CLI)')
  .version('1.0.0')
  .option('-j, --job <id>', 'UUID of specific job to process')
  .option('-p, --poll', 'Poll for pending jobs from database continuously')
  .action(async (options) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[Worker Error] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
      process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (options.job) {
      console.log(`[Worker] Starting job execution: ${options.job}`);
      await processJob(supabase, options.job);
    } else if (options.poll) {
      console.log('[Worker] Starting polling daemon for jobs (tier t2/t3)...');
      while (true) {
        const { data: job } = await supabase
          .from('jobs')
          .select('*')
          .in('status', ['queued', 'needs_local'])
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (job) {
          console.log(`[Worker] Claimed pending job: ${job.id}`);
          await processJob(supabase, job.id);
        } else {
          // Sleep 5 seconds before polling again
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    } else {
      program.help();
    }
  });

async function processJob(supabase: any, jobId: string) {
  try {
    // 1. Claim job and update status
    const { data: job, error: claimErr } = await supabase
      .from('jobs')
      .update({
        status: 'fetching',
        step: 'Claiming job and downloading media info',
        progress: 10,
        locked_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select('*, media_items(*)')
      .single();

    if (claimErr || !job) {
      console.error(`[Worker] Failed to claim job ${jobId}:`, claimErr);
      return;
    }

    console.log(`[Worker] Processing media: ${job.media_items?.source_url}`);

    // Update progress
    await supabase.from('jobs').update({
      status: 'compressing',
      step: 'Processing HLS video compression with ffmpeg',
      progress: 50,
    }).eq('id', jobId);

    // Simulate pipeline steps for demo/worker
    await new Promise((r) => setTimeout(r, 2000));

    await supabase.from('jobs').update({
      status: 'translating',
      step: 'Batch translating transcript segments',
      progress: 80,
    }).eq('id', jobId);

    await new Promise((r) => setTimeout(r, 1000));

    // Finish job
    await supabase.from('jobs').update({
      status: 'ready',
      step: 'Completed successfully',
      progress: 100,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);

    await supabase.from('media_items').update({
      status: 'ready',
      updated_at: new Date().toISOString(),
    }).eq('id', job.media_id);

    console.log(`[Worker] Job ${jobId} completed successfully!`);
  } catch (err: unknown) {
    console.error(`[Worker] Job ${jobId} failed:`, err);
    await supabase.from('jobs').update({
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);
  }
}

program.parse(process.argv);

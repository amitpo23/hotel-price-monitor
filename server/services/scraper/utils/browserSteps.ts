/**
 * Browser Steps Executor
 * Record and replay browser interactions (similar to changedetection.io)
 */

import { BrowserStep } from '../types';
import type { Page } from 'playwright';

export class BrowserStepsExecutor {
  /**
   * Execute a sequence of browser steps
   */
  static async execute(page: Page, steps: BrowserStep[]): Promise<void> {
    console.log(`[BrowserSteps] Executing ${steps.length} step(s)...`);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`[BrowserSteps] Step ${i + 1}/${steps.length}: ${step.type}`, step.description || '');

      try {
        await this.executeStep(page, step);
      } catch (error: any) {
        console.error(`[BrowserSteps] Step ${i + 1} failed:`, error.message);
        throw new Error(`Browser step "${step.type}" failed: ${error.message}`);
      }
    }

    console.log(`[BrowserSteps] All steps completed successfully`);
  }

  /**
   * Execute a single browser step
   */
  private static async executeStep(page: Page, step: BrowserStep): Promise<void> {
    const timeout = step.timeout || 30000;

    switch (step.type) {
      case 'click':
        if (!step.selector) {
          throw new Error('Click step requires a selector');
        }
        await page.click(step.selector, { timeout });
        // Wait a bit after click to let page update
        await page.waitForTimeout(500);
        break;

      case 'fill':
        if (!step.selector || step.value === undefined) {
          throw new Error('Fill step requires selector and value');
        }
        await page.fill(step.selector, step.value, { timeout });
        break;

      case 'select':
        if (!step.selector || step.value === undefined) {
          throw new Error('Select step requires selector and value');
        }
        await page.selectOption(step.selector, step.value, { timeout });
        break;

      case 'wait':
        const waitTime = step.timeout || 1000;
        console.log(`[BrowserSteps] Waiting ${waitTime}ms...`);
        await page.waitForTimeout(waitTime);
        break;

      case 'waitForSelector':
        if (!step.selector) {
          throw new Error('WaitForSelector step requires a selector');
        }
        await page.waitForSelector(step.selector, { timeout, state: 'visible' });
        break;

      case 'screenshot':
        const screenshotPath = step.value || `step_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`[BrowserSteps] Screenshot saved: ${screenshotPath}`);
        break;

      case 'executeJs':
        if (!step.code) {
          throw new Error('ExecuteJs step requires code');
        }
        await page.evaluate(step.code);
        break;

      default:
        throw new Error(`Unknown step type: ${(step as any).type}`);
    }
  }

  /**
   * Common pre-defined step sequences for hotel booking sites
   */
  static getBookingComSteps(checkIn: string, checkOut: string, adults: number = 2): BrowserStep[] {
    return [
      {
        type: 'waitForSelector',
        selector: 'input[name="checkin"], [data-testid="date-display-field-start"]',
        timeout: 10000,
        description: 'Wait for check-in date picker'
      },
      {
        type: 'click',
        selector: 'input[name="checkin"], [data-testid="date-display-field-start"]',
        description: 'Click check-in date field'
      },
      {
        type: 'wait',
        timeout: 1000,
        description: 'Wait for calendar to open'
      },
      {
        type: 'executeJs',
        code: `
          // Set check-in date
          const checkinInput = document.querySelector('input[name="checkin"]');
          if (checkinInput) {
            checkinInput.value = '${checkIn}';
            checkinInput.dispatchEvent(new Event('input', { bubbles: true }));
            checkinInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        `,
        description: 'Set check-in date via JavaScript'
      },
      {
        type: 'executeJs',
        code: `
          // Set check-out date
          const checkoutInput = document.querySelector('input[name="checkout"]');
          if (checkoutInput) {
            checkoutInput.value = '${checkOut}';
            checkoutInput.dispatchEvent(new Event('input', { bubbles: true }));
            checkoutInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        `,
        description: 'Set check-out date via JavaScript'
      },
      {
        type: 'wait',
        timeout: 500,
        description: 'Wait for date update'
      },
      {
        type: 'executeJs',
        code: `
          // Set number of adults
          const guestsInput = document.querySelector('input[name="group_adults"]');
          if (guestsInput) {
            guestsInput.value = '${adults}';
            guestsInput.dispatchEvent(new Event('input', { bubbles: true }));
            guestsInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        `,
        description: 'Set number of adults'
      },
      {
        type: 'waitForSelector',
        selector: '[data-testid="property-card"], .hprt-table, .room-block',
        timeout: 15000,
        description: 'Wait for rooms to load'
      }
    ];
  }

  /**
   * Accept cookies banner (common on booking sites)
   */
  static getAcceptCookiesSteps(): BrowserStep[] {
    return [
      {
        type: 'wait',
        timeout: 1000,
        description: 'Wait for cookie banner'
      },
      {
        type: 'executeJs',
        code: `
          // Try to find and click accept cookies button
          const cookieButtons = [
            document.querySelector('[data-testid="cookie-banner-accept"]'),
            document.querySelector('#onetrust-accept-btn-handler'),
            document.querySelector('.cookie-accept'),
            document.querySelector('[aria-label*="Accept"]'),
            document.querySelector('button[class*="accept"]')
          ];
          
          for (const btn of cookieButtons) {
            if (btn) {
              btn.click();
              console.log('Cookie banner accepted');
              break;
            }
          }
        `,
        description: 'Accept cookies if banner exists'
      }
    ];
  }

  /**
   * Close popups and overlays
   */
  static getClosePopupsSteps(): BrowserStep[] {
    return [
      {
        type: 'wait',
        timeout: 1000,
        description: 'Wait for popups'
      },
      {
        type: 'executeJs',
        code: `
          // Try to close any modal/popup
          const closeButtons = [
            document.querySelector('[data-testid="modal-close"]'),
            document.querySelector('.modal-close'),
            document.querySelector('[aria-label*="Close"]'),
            document.querySelector('.close-icon')
          ];
          
          for (const btn of closeButtons) {
            if (btn && btn.offsetParent !== null) {
              btn.click();
              console.log('Popup closed');
              break;
            }
          }
        `,
        description: 'Close any visible popups'
      }
    ];
  }

  /**
   * Combine common steps for hotel booking flow
   */
  static getCompleteBookingFlow(
    checkIn: string,
    checkOut: string,
    adults: number = 2
  ): BrowserStep[] {
    return [
      ...this.getAcceptCookiesSteps(),
      ...this.getClosePopupsSteps(),
      ...this.getBookingComSteps(checkIn, checkOut, adults)
    ];
  }
}

/**
 * Record browser steps from user interaction (for future implementation)
 */
export class BrowserStepsRecorder {
  private steps: BrowserStep[] = [];
  private isRecording = false;

  /**
   * Start recording browser interactions
   */
  async startRecording(page: Page): Promise<void> {
    this.isRecording = true;
    this.steps = [];

    // Inject recording script into page
    await page.addInitScript(() => {
      // This would record clicks, fills, etc.
      // Implementation would send events back to Node.js
    });

    console.log('[BrowserStepsRecorder] Recording started');
  }

  /**
   * Stop recording and return steps
   */
  stopRecording(): BrowserStep[] {
    this.isRecording = false;
    console.log(`[BrowserStepsRecorder] Recording stopped. ${this.steps.length} steps recorded.`);
    return this.steps;
  }

  /**
   * Export steps as JSON
   */
  exportSteps(): string {
    return JSON.stringify(this.steps, null, 2);
  }
}

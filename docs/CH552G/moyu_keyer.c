// ===================================================================================
// Project:   MoYu CW Keyer Firmware for CH552G
// Target:    MuseLab CH552G USB Core Board
// License:   MIT
// ===================================================================================

#include "src/system.h"
#include "src/usb_cdc.h"

// Prototypes for used interrupts
void USB_interrupt(void);
void USB_ISR(void) __interrupt(INT_NO_USB) {
  USB_interrupt();
}

// Pin Definitions on P1:
// P1.4: Tip (Pin 2 of 3.5mm: 手键 / 自动键划 Dah)
// P1.5: Ring (Pin 3 of 3.5mm: 自动键点 Dit)
#define PIN_TIP_MASK   (1 << 4)
#define PIN_RING_MASK  (1 << 5)

void delay_us(uint16_t us) {
  while(us--) {
    __asm__("nop");
    __asm__("nop");
    __asm__("nop");
    __asm__("nop");
  }
}

void main(void) {
  uint8_t last_tip = 1;
  uint8_t last_ring = 1;

  // Setup system clock (16 MHz) & USB CDC
  CLK_config();
  CDC_init();

  // Configure P1.4 and P1.5:
  // Quasi-bidirectional with pull-up (standard 8051 mode)
  // P1_MOD_OC = 0x92, P1_DIR_PU = 0x93
  P1_MOD_OC |= (PIN_TIP_MASK | PIN_RING_MASK);
  P1_DIR_PU |= (PIN_TIP_MASK | PIN_RING_MASK);
  P1 |= (PIN_TIP_MASK | PIN_RING_MASK);

  while(1) {
    uint8_t cur_tip = (P1 & PIN_TIP_MASK) ? 1 : 0;
    uint8_t cur_ring = (P1 & PIN_RING_MASK) ? 1 : 0;

    // Check P14 (Tip - 手键 / 划)
    if(cur_tip != last_tip) {
      delay_us(500); // 0.5ms debounce
      cur_tip = (P1 & PIN_TIP_MASK) ? 1 : 0;
      if(cur_tip != last_tip) {
        last_tip = cur_tip;
        if(cur_tip == 0) {
          // Tip Grounded -> KEY DOWN
          CDC_writeflush(0x01);
        } else {
          // Tip Released -> KEY UP
          CDC_writeflush(0x00);
        }
      }
    }

    // Check P15 (Ring - 自动键点)
    if(cur_ring != last_ring) {
      delay_us(500); // 0.5ms debounce
      cur_ring = (P1 & PIN_RING_MASK) ? 1 : 0;
      if(cur_ring != last_ring) {
        last_ring = cur_ring;
        if(cur_ring == 0) {
          // Ring Grounded -> DIT DOWN
          CDC_writeflush(0x02);
        } else {
          // Ring Released -> DIT UP
          CDC_writeflush(0x03);
        }
      }
    }
  }
}

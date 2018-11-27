import {
  AfterContentInit,
  AfterViewInit,
  Component,
  ContentChildren,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  QueryList,
  Renderer2,
  ViewChild
} from '@angular/core';
import { animate, style, AnimationBuilder } from '@angular/animations';
import { interval, BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

import { MatCarousel } from './carousel';
import { MatCarouselSlideComponent } from './carousel-slide/carousel-slide.component';

@Component({
  selector: 'mat-carousel',
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.scss']
})
export class MatCarouselComponent
  implements AfterContentInit, AfterViewInit, MatCarousel, OnDestroy, OnInit {
  // Attributes.
  @Input()
  public timings = '250ms ease-in';
  @Input()
  public loop = true;
  @Input()
  public autoplay = true;
  @Input()
  public autoplayInterval = 5000;
  @Input()
  public showArrows = true;
  @Input()
  public showIndicators = true;
  @Input()
  public awaitAnimation = false;
  @Input()
  public proportion = 25;
  @Input()
  public maxWidth: string;
  @Input()
  public set maxSlides(value: number) {
    this.todo$.next(value);
  }
  @Input()
  public color = 'accent';

  // Elements.
  @ContentChildren(MatCarouselSlideComponent)
  public slides: QueryList<MatCarouselSlideComponent>;

  public currentIndex = 0;
  public playing = false;

  @ViewChild('carouselContainer')
  private carouselContainer: ElementRef;
  @ViewChild('carouselList')
  private carouselList: ElementRef;

  private interval$: Observable<number>;
  private stopInterval$ = new Subject<never>();
  private todo$ = new BehaviorSubject<number>(null);
  private ngOnDestroy$ = new Subject<never>();

  constructor(
    private animationBuilder: AnimationBuilder,
    private renderer: Renderer2
  ) {}

  public ngAfterContentInit(): void {
    this.todo$
      .pipe(
        takeUntil(this.ngOnDestroy$),
        filter(n => !!n)
      )
      .subscribe((value: number) => {
        this.resetSlides(value);
      });
  }

  public ngAfterViewInit(): void {
    this.startTimer();
  }

  public ngOnDestroy(): void {
    this.ngOnDestroy$.next();
    this.ngOnDestroy$.complete();
  }

  public ngOnInit(): void {
    this.interval$ = interval(this.autoplayInterval);
  }

  public next(force = false): void {
    if (this.awaitAnimation && this.playing) {
      return;
    }
    if (!force && !this.loop && this.currentIndex === this.slides.length - 1) {
      return;
    }
    this.show(this.currentIndex + 1);
  }

  public onPan(event: any, slideElem: HTMLElement): void {
    let Δx = event.deltaX;
    if (this.isOutOfBounds()) {
      Δx *= 0.2; // decelerate movement;
    }

    this.renderer.setStyle(slideElem, 'cursor', 'grabbing');
    this.renderer.setStyle(
      this.carouselList.nativeElement,
      'transform',
      this.getTranslation(-this.getOffset() + Δx)
    );
  }

  public onPanEnd(event: any, slideElem: HTMLElement): void {
    this.renderer.removeStyle(slideElem, 'cursor');

    if (
      !this.isOutOfBounds() &&
      Math.abs(event.deltaX) > this.getWidth() * 0.25
    ) {
      if (event.deltaX <= 0) {
        this.next();
        return;
      }
      this.previous();
      return;
    }
    this.playAnimation();
  }

  public previous(force = false): void {
    if (this.awaitAnimation && this.playing) {
      return;
    }
    if (!force && !this.loop && this.currentIndex === 0) {
      return;
    }
    this.show(this.currentIndex - 1);
  }

  public show(index: number): void {
    this.setCurrent(index);
    this.playAnimation();
  }

  @HostListener('mouseenter')
  public onMouseEnter(): void {
    this.stopInterval$.next();
  }

  @HostListener('mouseleave')
  public onMouseLeave(): void {
    this.startTimer();
  }

  @HostListener('window:resize', ['$event'])
  public onResize(event: Event): void {
    // Reset carousel when window is resized
    // in order to avoid major glitches.
    this.show(0);
  }

  private isOutOfBounds(): boolean {
    const el = this.carouselList.nativeElement as HTMLElement;
    const left = el.getBoundingClientRect().left;
    const lastIndex = this.slides.length - 1;

    return (
      (this.currentIndex === 0 && left >= 0) ||
      (this.currentIndex === lastIndex && left <= -this.getWidth() * lastIndex)
    );
  }

  private getOffset(): number {
    const offset = this.currentIndex * this.getWidth();
    return offset;
  }

  private getTranslation(offset: number): string {
    return `translateX(${offset}px)`;
  }

  private getWidth(): number {
    const el = this.carouselContainer.nativeElement as HTMLElement;
    return el.clientWidth;
  }

  private playAnimation(): void {
    const translation = this.getTranslation(-this.getOffset());
    const factory = this.animationBuilder.build(
      animate(
        this.timings,
        style({
          transform: translation
        })
      )
    );
    const el = this.carouselList.nativeElement as HTMLElement;
    const animation = factory.create(el);

    animation.onStart(() => (this.playing = true));
    animation.onDone(() => {
      this.playing = false;
      this.renderer.setStyle(el, 'transform', translation);
      animation.destroy();
    });
    animation.play();
  }

  private resetSlides(maxSlides: number): void {
    this.slides.reset(this.slides.toArray().slice(0, maxSlides));
  }

  private setCurrent(index: number) {
    this.currentIndex =
      index === this.slides.length
        ? 0 // start carousel over
        : index < 0
        ? this.slides.length - 1 // go to last slide
        : index;
  }

  private startTimer(): void {
    if (this.autoplay) {
      this.interval$
        .pipe(
          takeUntil(this.stopInterval$),
          takeUntil(this.ngOnDestroy$)
        )
        .subscribe(() => this.next(true));
    }
  }
}

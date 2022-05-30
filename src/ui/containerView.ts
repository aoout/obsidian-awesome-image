import {CONTAINER_TYPE, IMG_DEFAULT_BACKGROUND_COLOR} from "src/conf/constants";
import ImageToolkitPlugin from "src/main";
import {ImgStatusIto, ImgInfoIto} from "src/to/imgTo";
import {ImgUtil} from "src/util/imgUtil";
import {IMG_GLOBAL_SETTINGS} from "../conf/settings";
import {OffsetSizeIto} from "../to/commonTo";

export abstract class ContainerView {

    protected containerType: keyof typeof CONTAINER_TYPE;

    protected readonly plugin: ImageToolkitPlugin;

    // the clicked original image element
    protected targetOriginalImgEl: HTMLImageElement;

    protected realImgInterval: NodeJS.Timeout;

    protected defaultImgStyles = {
        transform: 'none',
        filter: 'none',
        mixBlendMode: 'normal',

        borderWidth: '',
        borderStyle: '',
        borderColor: ''
    }

    protected imgStatus: ImgStatusIto = {
        popup: false,

        dragging: false,

        arrowUp: false,
        arrowDown: false,
        arrowLeft: false,
        arrowRight: false
    }

    protected imgInfo: ImgInfoIto = {
        oitContainerViewEl: null,
        imgViewEl: null,
        imgTitleEl: null,
        imgTipEl: null,
        imgTipTimeout: null,
        imgFooterEl: null,
        imgPlayerEl: null,
        imgPlayerImgViewEl: null,

        curWidth: 0,
        curHeight: 0,
        realWidth: 0,
        realHeight: 0,
        left: 0,
        top: 0,
        moveX: 0,
        moveY: 0,
        rotate: 0,

        invertColor: false,
        scaleX: false,
        scaleY: false,

        fullScreen: false
    }

    protected constructor(plugin: ImageToolkitPlugin, containerType: keyof typeof CONTAINER_TYPE) {
        this.plugin = plugin;
        this.containerType = containerType;
    }

    public getPlugin = (): ImageToolkitPlugin => {
        return this.plugin;
    }

    public getTargetOriginalImgEl = (): HTMLImageElement => {
        return this.targetOriginalImgEl;
    }

    /**
     * render when clicking an image
     * @param targetEl the clicked image's element
     * @returns
     */
    public renderContainerView = (targetEl: HTMLImageElement): void => {
        if (this.imgStatus.popup || !this.checkType()) return;
        this.initContainerView(targetEl, this.plugin.app.workspace.containerEl);
        this.openOitContainerView();
        this.renderGalleryNavbar();
        this.refreshImg(targetEl.src, targetEl.alt);
    }

    public initContainerView = (targetEl: HTMLImageElement, containerEl: HTMLElement): void => {
        this.initContainerViewDom(containerEl);
        this.restoreBorderForLastTargetOriginalImg(targetEl);
        this.initDefaultData(window.getComputedStyle(targetEl));
        this.addBorderForTargetOriginalImg(targetEl);
        this.addOrRemoveEvents(true); // add events
    }

    protected initContainerViewDom = (containerEl: HTMLElement): void => {
    }

    protected openOitContainerView = () => {
        if (!this.imgInfo.oitContainerViewEl) {
            console.error('obsidian-image-toolkit: oit-main-container-view has not been initialized!');
            return;
        }
        this.imgStatus.popup = true;
        // display 'oit-main-container-view' or 'oit-pin-container-view'
        this.imgInfo.oitContainerViewEl.style.setProperty('display', 'block');
    }

    abstract closeViewContainer(event?: MouseEvent): void;

    protected checkType = (): boolean => {
        if (!this.containerType) return false;
        switch (this.containerType) {
            case 'MAIN':
                return !this.plugin.settings.pinMode;
            case 'PIN':
                return this.plugin.settings.pinMode;
            default:
                break;
        }
        return false;
    }

    public initDefaultData = (targetImgStyle: CSSStyleDeclaration) => {
        if (targetImgStyle) {
            this.defaultImgStyles.transform = 'none';
            this.defaultImgStyles.filter = targetImgStyle.filter;
            // @ts-ignore
            this.defaultImgStyles.mixBlendMode = targetImgStyle.mixBlendMode;

            this.defaultImgStyles.borderWidth = targetImgStyle.borderWidth;
            this.defaultImgStyles.borderStyle = targetImgStyle.borderStyle;
            this.defaultImgStyles.borderColor = targetImgStyle.borderColor;
        }

        this.imgStatus.dragging = false;
        this.imgStatus.arrowUp = false;
        this.imgStatus.arrowDown = false;
        this.imgStatus.arrowLeft = false;
        this.imgStatus.arrowRight = false;

        this.imgInfo.invertColor = false;
        this.imgInfo.scaleX = false;
        this.imgInfo.scaleY = false;
        this.imgInfo.fullScreen = false;
    }

    protected setTargetOriginalImg = (targetEl: HTMLImageElement) => {
        if (!targetEl) return;
        targetEl.setAttribute('data-oit-target', '1');
        this.targetOriginalImgEl = targetEl;
    }

    protected addBorderForTargetOriginalImg = (targetEl: HTMLImageElement) => {
        this.setTargetOriginalImg(targetEl);
        if (!targetEl || !this.plugin.settings.imageBorderToggle) return;
        const targetOriginalImgStyle = targetEl?.style;
        if (!targetOriginalImgStyle) return;
        targetOriginalImgStyle.setProperty('border-width', this.plugin.settings.imageBorderWidth);
        targetOriginalImgStyle.setProperty('border-style', this.plugin.settings.imageBorderStyle);
        targetOriginalImgStyle.setProperty('border-color', this.plugin.settings.imageBorderColor);
    }

    protected restoreBorderForLastTargetOriginalImg = (targetEl: HTMLImageElement) => {
        if (!this.targetOriginalImgEl) return;
        this.targetOriginalImgEl.removeAttribute('data-oit-target');
        const targetOriginalImgStyle = this.targetOriginalImgEl.style;
        if (targetOriginalImgStyle) {
            targetOriginalImgStyle.setProperty('border-width', this.defaultImgStyles.borderWidth);
            targetOriginalImgStyle.setProperty('border-style', this.defaultImgStyles.borderStyle);
            targetOriginalImgStyle.setProperty('border-color', this.defaultImgStyles.borderColor);
        }
    }

    public refreshImg = (imgSrc?: string, imgAlt?: string) => {
        const src = imgSrc ? imgSrc : this.imgInfo.imgViewEl.src;
        const alt = imgAlt ? imgAlt : this.imgInfo.imgViewEl.alt;
        this.renderImgTitle(alt);
        if (src) {
            if (this.realImgInterval) {
                clearInterval(this.realImgInterval);
                this.realImgInterval = null;
            }
            let realImg = new Image();
            realImg.src = src;
            this.realImgInterval = setInterval((img) => {
                if (img.width > 0 || img.height > 0) {
                    clearInterval(this.realImgInterval);
                    this.realImgInterval = null;
                    this.setImgViewPosition(ImgUtil.calculateImgZoomSize(img, this.imgInfo), 0);
                    this.renderImgView(src, alt);
                    this.renderImgTip();
                    this.imgInfo.imgViewEl.style.setProperty('transform', this.defaultImgStyles.transform);
                    this.imgInfo.imgViewEl.style.setProperty('filter', this.defaultImgStyles.filter);
                    this.imgInfo.imgViewEl.style.setProperty('mix-blend-mode', this.defaultImgStyles.mixBlendMode);
                }
            }, 40, realImg);
        }
    }

    protected renderImgTitle = (alt: string): void => {
    }

    protected setImgViewPosition = (imgZoomSize: ImgInfoIto, rotate?: number) => {
        if (imgZoomSize) {
            this.imgInfo.imgViewEl.setAttribute('width', imgZoomSize.curWidth + 'px');
            this.imgInfo.imgViewEl.style.setProperty('margin-top', imgZoomSize.top + 'px', 'important');
            this.imgInfo.imgViewEl.style.setProperty('margin-left', imgZoomSize.left + 'px', 'important');
        }
        const rotateDeg = rotate ? rotate : 0;
        this.imgInfo.imgViewEl.style.transform = 'rotate(' + rotateDeg + 'deg)';
        this.imgInfo.rotate = rotateDeg;
    }

    protected renderImgView = (src: string, alt: string) => {
        if (!this.imgInfo.imgViewEl) return;
        this.imgInfo.imgViewEl.setAttribute('src', src);
        this.imgInfo.imgViewEl.setAttribute('alt', alt);
    }

    public renderImgTip = () => {
        if (this.imgInfo.realWidth > 0 && this.imgInfo.curWidth > 0) {
            if (this.imgInfo.imgTipTimeout) {
                clearTimeout(this.imgInfo.imgTipTimeout);
            }
            if (this.plugin.settings.imgTipToggle) {
                this.imgInfo.imgTipEl.hidden = false; // display 'img-tip'
                this.imgInfo.imgTipEl.setText(parseInt(this.imgInfo.curWidth * 100 / this.imgInfo.realWidth + '') + '%');
                this.imgInfo.imgTipTimeout = setTimeout(() => {
                    this.imgInfo.imgTipEl.hidden = true;
                }, 1000);
            } else {
                this.imgInfo.imgTipEl.hidden = true; // hide 'img-tip'
                this.imgInfo.imgTipTimeout = null;
            }
        }
    }

    public setImgViewDefaultBackground = () => {
        if (!this.imgInfo.imgViewEl) return;
        const color = this.plugin.settings.imgViewBackgroundColor;
        if (color && IMG_DEFAULT_BACKGROUND_COLOR != color) {
            this.imgInfo.imgViewEl.removeClass('img-default-background');
            this.imgInfo.imgViewEl.style.setProperty('background-color', color);
        } else {
            this.imgInfo.imgViewEl.addClass('img-default-background');
            this.imgInfo.imgViewEl.style.removeProperty('background-color');
        }
    }

    /***********************************************************************************************************************
     Gallery NavBar: start
     ***********************************************************************************************************************/
    protected switchImageOnGalleryNavBar = (event: KeyboardEvent, next: boolean) => {
    }

    protected renderGalleryNavbar = () => {
    }
    /***********************************************************************************************************************
     Gallery NavBar: end
     ***********************************************************************************************************************/

    /***********************************************************************************************************************
     full screen : start
     ***********************************************************************************************************************/
    /**
     * close full screen
     */
    protected closePlayerImg = () => {
        this.imgInfo.fullScreen = false;
        if (this.imgInfo.imgPlayerEl) {
            this.imgInfo.imgPlayerEl?.style.setProperty('display', 'none'); // hide 'img-player'
            this.imgInfo.imgPlayerEl.removeEventListener('click', this.closePlayerImg);
        }
        if (this.imgInfo.imgPlayerImgViewEl) {
            this.imgInfo.imgPlayerImgViewEl.setAttribute('src', '');
            this.imgInfo.imgPlayerImgViewEl.setAttribute('alt', '');
        }
        this.imgInfo.imgViewEl?.style.setProperty('display', 'block', 'important');
        this.imgInfo.imgFooterEl?.style.setProperty('display', 'block');
    }
    /***********************************************************************************************************************
     full screen : end
     ***********************************************************************************************************************/


    /***********************************************************************************************************************
     all events: start
     ***********************************************************************************************************************/
    protected addOrRemoveEvents = (flag: boolean) => {
        if (flag) {
            document.addEventListener('keyup', this.triggerKeyup);
            document.addEventListener('keydown', this.triggerKeydown);
            this.imgInfo.oitContainerViewEl.addEventListener('click', this.closeViewContainer);
            // drag the image via mouse
            this.imgInfo.imgViewEl.addEventListener('mousedown', this.mousedownImgView);
            // zoom the image via mouse wheel
            this.imgInfo.imgViewEl.addEventListener('mousewheel', this.mousewheelViewContainer, {passive: true});
        } else {
            // flag = false
            document.removeEventListener('keyup', this.triggerKeyup);
            document.removeEventListener('keydown', this.triggerKeydown);
            this.imgInfo.oitContainerViewEl.removeEventListener('click', this.closeViewContainer);
            this.imgInfo.imgViewEl.removeEventListener('mousedown', this.mousedownImgView);
            this.imgInfo.oitContainerViewEl.removeEventListener('mousewheel', this.mousewheelViewContainer);
            if (this.realImgInterval) {
                clearInterval(this.realImgInterval);
                this.realImgInterval = null;
            }
        }
    }

    protected triggerKeyup = (event: KeyboardEvent) => {
        // console.log('keyup', event, event.key);
        event.preventDefault();
        event.stopPropagation();
        switch (event.key) {
            case 'Escape':
                this.imgInfo.fullScreen ? this.closePlayerImg() : this.closeViewContainer();
                break;
            case 'ArrowUp':
                this.imgStatus.arrowUp = false;
                break;
            case 'ArrowDown':
                this.imgStatus.arrowDown = false;
                break;
            case 'ArrowLeft':
                this.imgStatus.arrowLeft = false;
                // switch to the previous image
                this.switchImageOnGalleryNavBar(event, false);
                break;
            case 'ArrowRight':
                this.imgStatus.arrowRight = false;
                // switch to the next image
                this.switchImageOnGalleryNavBar(event, true);
                break;
            default:
                break
        }
    }

    protected triggerKeydown = (event: KeyboardEvent) => {
        // console.log('keydown', event, event.key, this.imgStatus);
        event.preventDefault();
        event.stopPropagation();
        if (this.imgStatus.arrowUp && this.imgStatus.arrowLeft) {
            this.moveImgViewByHotkey(event, 'UP_LEFT');
            return;
        } else if (this.imgStatus.arrowUp && this.imgStatus.arrowRight) {
            this.moveImgViewByHotkey(event, 'UP_RIGHT');
            return;
        } else if (this.imgStatus.arrowDown && this.imgStatus.arrowLeft) {
            this.moveImgViewByHotkey(event, 'DOWN_LEFT');
            return;
        } else if (this.imgStatus.arrowDown && this.imgStatus.arrowRight) {
            this.moveImgViewByHotkey(event, 'DOWN_RIGHT');
            return;
        }
        switch (event.key) {
            case 'ArrowUp':
                this.imgStatus.arrowUp = true;
                this.moveImgViewByHotkey(event, 'UP');
                break;
            case 'ArrowDown':
                this.imgStatus.arrowDown = true;
                this.moveImgViewByHotkey(event, 'DOWN');
                break;
            case 'ArrowLeft':
                this.imgStatus.arrowLeft = true;
                this.moveImgViewByHotkey(event, 'LEFT');
                break;
            case 'ArrowRight':
                this.imgStatus.arrowRight = true;
                this.moveImgViewByHotkey(event, 'RIGHT');
                break;
            default:
                break
        }
    }

    protected moveImgViewByHotkey = (event: KeyboardEvent, orientation: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'UP_LEFT' | 'UP_RIGHT' | 'DOWN_LEFT' | 'DOWN_RIGHT') => {
        if (!orientation || !this.imgStatus.popup || !this.checkHotkeySettings(event, this.plugin.settings.moveTheImageHotkey))
            return;
        switch (orientation) {
            case 'UP':
                this.mousemoveImgView(null, {offsetX: 0, offsetY: -IMG_GLOBAL_SETTINGS.imageMoveSpeed});
                break;
            case 'DOWN':
                this.mousemoveImgView(null, {offsetX: 0, offsetY: IMG_GLOBAL_SETTINGS.imageMoveSpeed});
                break;
            case 'LEFT':
                this.mousemoveImgView(null, {offsetX: -IMG_GLOBAL_SETTINGS.imageMoveSpeed, offsetY: 0});
                break;
            case 'RIGHT':
                this.mousemoveImgView(null, {offsetX: IMG_GLOBAL_SETTINGS.imageMoveSpeed, offsetY: 0});
                break;
            case 'UP_LEFT':
                this.mousemoveImgView(null, {
                    offsetX: -IMG_GLOBAL_SETTINGS.imageMoveSpeed,
                    offsetY: -IMG_GLOBAL_SETTINGS.imageMoveSpeed
                });
                break;
            case 'UP_RIGHT':
                this.mousemoveImgView(null, {
                    offsetX: IMG_GLOBAL_SETTINGS.imageMoveSpeed,
                    offsetY: -IMG_GLOBAL_SETTINGS.imageMoveSpeed
                });
                break;
            case 'DOWN_LEFT':
                this.mousemoveImgView(null, {
                    offsetX: -IMG_GLOBAL_SETTINGS.imageMoveSpeed,
                    offsetY: IMG_GLOBAL_SETTINGS.imageMoveSpeed
                });
                break;
            case 'DOWN_RIGHT':
                this.mousemoveImgView(null, {
                    offsetX: IMG_GLOBAL_SETTINGS.imageMoveSpeed,
                    offsetY: IMG_GLOBAL_SETTINGS.imageMoveSpeed
                });
                break;
            default:
                break;
        }
    }

    protected checkHotkeySettings = (event: KeyboardEvent, hotkey: string): boolean => {
        switch (hotkey) {
            case "NONE":
                return !event.ctrlKey && !event.altKey && !event.shiftKey;
            case "CTRL":
                return event.ctrlKey && !event.altKey && !event.shiftKey;
            case "ALT":
                return !event.ctrlKey && event.altKey && !event.shiftKey;
            case "SHIFT":
                return !event.ctrlKey && !event.altKey && event.shiftKey;
            case "CTRL_ALT":
                return event.ctrlKey && event.altKey && !event.shiftKey;
            case "CTRL_SHIFT":
                return event.ctrlKey && !event.altKey && event.shiftKey;
            case "SHIFT_ALT":
                return !event.ctrlKey && event.altKey && event.shiftKey;
            case "CTRL_SHIFT_ALT":
                return event.ctrlKey && event.altKey && event.shiftKey;
        }
        return false;
    }

    protected mousemoveImgView = (event: MouseEvent, offsetSize?: OffsetSizeIto) => {
        if (!this.imgStatus.dragging && !offsetSize) return;
        if (event) {
            this.imgInfo.left = event.clientX + this.imgInfo.moveX;
            this.imgInfo.top = event.clientY + this.imgInfo.moveY;
        } else if (offsetSize) {
            this.imgInfo.left += offsetSize.offsetX;
            this.imgInfo.top += offsetSize.offsetY;
        } else {
            return;
        }
        // move the image
        this.imgInfo.imgViewEl.style.setProperty('margin-top', this.imgInfo.top + 'px', 'important');
        this.imgInfo.imgViewEl.style.setProperty('margin-left', this.imgInfo.left + 'px', 'important');
    }

    protected mousedownImgView = (event: MouseEvent) => {
        // console.log('mousedownImgView', event);
        event.stopPropagation();
        event.preventDefault();
        this.imgStatus.dragging = true;
        // 鼠标相对于图片的位置
        this.imgInfo.moveX = this.imgInfo.imgViewEl.offsetLeft - event.clientX;
        this.imgInfo.moveY = this.imgInfo.imgViewEl.offsetTop - event.clientY;
        // 鼠标按下时持续触发/移动事件
        this.imgInfo.oitContainerViewEl.onmousemove = this.mousemoveImgView;
        // 鼠标松开/回弹触发事件
        this.imgInfo.oitContainerViewEl.onmouseup = this.mouseupImgView;
        this.imgInfo.oitContainerViewEl.onmouseleave = this.mouseupImgView;
    }

    protected mouseupImgView = (event: MouseEvent) => {
        // console.log('mouseup...');
        this.imgStatus.dragging = false;
        event.preventDefault();
        event.stopPropagation();
        this.imgInfo.imgViewEl.onmousemove = null;
        this.imgInfo.imgViewEl.onmouseup = null;
    }

    protected mousewheelViewContainer = (event: WheelEvent) => {
        // event.preventDefault();
        event.stopPropagation();
        // @ts-ignore
        this.zoomAndRender(0 < event.wheelDelta ? 0.1 : -0.1, event);
    }

    /***********************************************************************************************************************
     all events: end
     ***********************************************************************************************************************/
}

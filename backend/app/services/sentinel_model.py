"""Sentinel Landslide4Sense architecture from the original supplied training notebook."""

import torch

from torch import nn

class ResidualConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
        )
        self.shortcut = (
            nn.Conv2d(in_ch, out_ch, kernel_size=1, bias=False)
            if in_ch != out_ch
            else nn.Identity()
        )
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        return self.relu(self.conv(x) + self.shortcut(x))

class LandslideResUNet(nn.Module):
    def __init__(self, in_channels=14):
        super().__init__()
        self.e1 = ResidualConvBlock(in_channels, 32)
        self.p1 = nn.MaxPool2d(2)
        self.e2 = ResidualConvBlock(32, 64)
        self.p2 = nn.MaxPool2d(2)
        self.e3 = ResidualConvBlock(64, 128)
        self.p3 = nn.MaxPool2d(2)

        self.bottleneck = ResidualConvBlock(128, 256)

        self.up3 = nn.ConvTranspose2d(256, 128, kernel_size=2, stride=2)
        self.d3 = ResidualConvBlock(256, 128)
        self.up2 = nn.ConvTranspose2d(128, 64, kernel_size=2, stride=2)
        self.d2 = ResidualConvBlock(128, 64)
        self.up1 = nn.ConvTranspose2d(64, 32, kernel_size=2, stride=2)
        self.d1 = ResidualConvBlock(64, 32)

        self.out_head = nn.Conv2d(32, 1, kernel_size=1)

    def forward(self, x):
        c1 = self.e1(x)
        c2 = self.e2(self.p1(c1))
        c3 = self.e3(self.p2(c2))

        b = self.bottleneck(self.p3(c3))

        u3 = self.up3(b)
        x3 = self.d3(torch.cat([u3, c3], dim=1))
        u2 = self.up2(x3)
        x2 = self.d2(torch.cat([u2, c2], dim=1))
        u1 = self.up1(x2)
        x1 = self.d1(torch.cat([u1, c1], dim=1))

        return self.out_head(x1)
